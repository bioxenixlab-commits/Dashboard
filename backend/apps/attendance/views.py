from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from django.db import transaction
from django.utils import timezone
from datetime import date, timedelta
from calendar import monthrange

from .models import Attendance, AttendanceSession
from .serializers import (
    AttendanceSerializer, AttendanceCreateSerializer, AttendanceBulkCreateSerializer,
    AttendanceSessionSerializer, AttendanceCalendarSerializer, AttendanceStatsSerializer
)
from apps.students.models import Student
from apps.batches.models import Batch
from apps.accounts.permissions import IsTeacher


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.select_related('student', 'student__batch', 'recorded_by')
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = ['student', 'date', 'status']
    ordering_fields = ['date', 'student__name']
    ordering = ['-date', 'student__student_class', 'student__roll']

    def get_serializer_class(self):
        if self.action in ['create']:
            return AttendanceCreateSerializer
        return AttendanceSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        student_class = self.request.query_params.get('class')
        if student_class:
            queryset = queryset.filter(student__student_class=student_class)
        
        batch_id = self.request.query_params.get('batch')
        if batch_id:
            queryset = queryset.filter(student__batch_id=batch_id)
        
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        
        return queryset

    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get today's attendance for a class/batch"""
        student_class = request.query_params.get('class')
        batch_id = request.query_params.get('batch')
        target_date = request.query_params.get('date', date.today())
        
        if not student_class:
            return Response({'detail': 'class parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        students = Student.objects.filter(student_class=student_class, is_active=True)
        if batch_id:
            students = students.filter(batch_id=batch_id)
        
        # Get existing attendance for today
        existing = Attendance.objects.filter(
            student__in=students,
            date=target_date
        ).select_related('student')
        
        existing_map = {a.student_id: a for a in existing}
        
        result = []
        for student in students:
            attendance = existing_map.get(student.id)
            result.append({
                'student': {
                    'id': student.id,
                    'student_id': student.student_id,
                    'name': student.name,
                    'roll': student.roll,
                    'batch': student.batch.display_name if student.batch else None,
                },
                'attendance': AttendanceSerializer(attendance).data if attendance else None
            })
        
        return Response({
            'date': target_date,
            'records': result
        })

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        serializer = AttendanceBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        target_date = serializer.validated_data.get('date', date.today())
        records = serializer.validated_data['records']
        student_class = serializer.validated_data.get('student_class')
        batch_id = serializer.validated_data.get('batch_id')
        
        created = 0
        updated = 0
        
        with transaction.atomic():
            # Create or update attendance session
            session, _ = AttendanceSession.objects.get_or_create(
                student_class=student_class,
                batch_id=batch_id,
                date=target_date,
                defaults={
                    'taken_by': request.user,
                    'is_completed': True
                }
            )
            session.taken_by = request.user
            session.is_completed = True
            session.save()
            
            for record in records:
                student_id = record['student_id']
                status = record['status']
                notes = record.get('notes', '')
                
                try:
                    student = Student.objects.get(id=student_id, is_active=True)
                except Student.DoesNotExist:
                    continue
                
                attendance, is_new = Attendance.objects.get_or_create(
                    student=student,
                    date=target_date,
                    defaults={
                        'status': status,
                        'notes': notes,
                        'recorded_by': request.user,
                    }
                )
                
                if is_new:
                    created += 1
                else:
                    attendance.status = status
                    attendance.notes = notes
                    attendance.recorded_by = request.user
                    attendance.save()
                    updated += 1
        
        return Response({'created': created, 'updated': updated})

    @action(detail=False, methods=['post'])
    def auto_save(self, request):
        """Auto-save single attendance record (for checkbox changes)"""
        serializer = AttendanceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        student_id = serializer.validated_data['student_id']
        att_status = serializer.validated_data['status']
        notes = serializer.validated_data.get('notes', '')
        target_date = request.data.get('date', date.today())
        # Handle date as string from frontend
        if isinstance(target_date, str):
            try:
                from datetime import datetime as dt
                target_date = dt.strptime(target_date, '%Y-%m-%d').date()
            except ValueError:
                target_date = date.today()
        
        try:
            student = Student.objects.get(id=student_id, is_active=True)
        except Student.DoesNotExist:
            return Response({'detail': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
        
        attendance, created = Attendance.objects.get_or_create(
            student=student,
            date=target_date,
            defaults={
                'status': att_status,
                'notes': notes,
                'recorded_by': request.user,
            }
        )
        
        if not created:
            attendance.status = att_status
            attendance.notes = notes
            attendance.recorded_by = request.user
            attendance.save()
        
        return Response(AttendanceSerializer(attendance).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def student_calendar(self, request):
        """Get attendance calendar for the logged-in student"""
        if request.user.role != 'student' or not request.user.student:
            return Response({'detail': 'Not a student account'}, status=status.HTTP_403_FORBIDDEN)
        
        student = request.user.student
        year = int(request.query_params.get('year', date.today().year))
        month = int(request.query_params.get('month', date.today().month))
        
        # Get first day of month and last day
        first_day = date(year, month, 1)
        last_day = date(year, month, monthrange(year, month)[1])
        
        attendance_records = Attendance.objects.filter(
            student=student,
            date__gte=first_day,
            date__lte=last_day
        ).order_by('date')
        
        calendar_data = []
        for record in attendance_records:
            calendar_data.append({
                'date': record.date,
                'status': record.status,
                'status_display': record.get_status_display(),
                'notes': record.notes,
            })
        
        return Response({
            'year': year,
            'month': month,
            'records': calendar_data
        })

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def student_stats(self, request):
        """Get attendance statistics for the logged-in student"""
        if request.user.role != 'student' or not request.user.student:
            return Response({'detail': 'Not a student account'}, status=status.HTTP_403_FORBIDDEN)
        
        student = request.user.student
        year = int(request.query_params.get('year', date.today().year))
        
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        
        records = Attendance.objects.filter(
            student=student,
            date__gte=start_date,
            date__lte=end_date
        )
        
        total = records.count()
        present = records.filter(status='present').count()
        absent = records.filter(status='absent').count()
        late = records.filter(status='late').count()
        excused = records.filter(status='excused').count()
        
        rate = round((present + late + excused) / total * 100, 2) if total > 0 else 0
        
        return Response({
            'student': student.id,
            'year': year,
            'total_days': total,
            'present_count': present,
            'absent_count': absent,
            'late_count': late,
            'excused_count': excused,
            'attendance_rate': rate,
        })

    @action(detail=False, methods=['get'])
    def class_stats(self, request):
        """Get attendance statistics for a class/batch"""
        student_class = request.query_params.get('class')
        batch_id = request.query_params.get('batch')
        year = int(request.query_params.get('year', date.today().year))
        
        if not student_class:
            return Response({'detail': 'class parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        students = Student.objects.filter(student_class=student_class, is_active=True)
        if batch_id:
            students = students.filter(batch_id=batch_id)
        
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        
        records = Attendance.objects.filter(
            student__in=students,
            date__gte=start_date,
            date__lte=end_date
        )
        
        stats = records.values('student').annotate(
            total=Count('id'),
            present=Count('id', filter=Q(status='present')),
            absent=Count('id', filter=Q(status='absent')),
            late=Count('id', filter=Q(status='late')),
            excused=Count('id', filter=Q(status='excused')),
        )
        
        result = []
        for stat in stats:
            student = students.get(id=stat['student'])
            total = stat['total']
            present = stat['present'] + stat['late'] + stat['excused']
            rate = round(present / total * 100, 2) if total > 0 else 0
            result.append({
                'student_id': student.id,
                'student_code': student.student_id,
                'name': student.name,
                'total_days': total,
                'present_count': stat['present'],
                'absent_count': stat['absent'],
                'late_count': stat['late'],
                'excused_count': stat['excused'],
                'attendance_rate': rate,
            })
        
        return Response({'stats': result})