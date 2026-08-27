from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Avg, Count, Q
from django.db import transaction
from datetime import date

from .models import Exam, ExamResult
from .serializers import (
    ExamSerializer, ExamCreateSerializer, ExamResultSerializer,
    ExamResultUpdateSerializer, ExamResultBulkUpdateSerializer,
    ExamDetailSerializer, ExamSummarySerializer, ExamPublishSerializer
)
from apps.students.models import Student
from apps.accounts.permissions import IsTeacher


class ExamViewSet(viewsets.ModelViewSet):
    queryset = Exam.objects.select_related('batch').prefetch_related('results__student')
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = ['exam_class', 'batch', 'is_published']
    search_fields = ['name', 'description']
    ordering_fields = ['exam_date', 'date_created', 'name']
    ordering = ['-date_created']

    def get_serializer_class(self):
        if self.action == 'create':
            return ExamCreateSerializer
        elif self.action == 'retrieve':
            return ExamDetailSerializer
        return ExamSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        student_class = self.request.query_params.get('class')
        if student_class:
            queryset = queryset.filter(exam_class=student_class)
        
        batch_id = self.request.query_params.get('batch')
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(description__icontains=search)
            )
        
        return queryset

    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        exam = self.get_object()
        students = Student.objects.filter(student_class=exam.exam_class, is_active=True)
        
        if exam.batch:
            students = students.filter(batch=exam.batch)
        
        results = []
        for student in students:
            result, created = ExamResult.objects.get_or_create(
                exam=exam,
                student=student,
                defaults={'is_absent': False}
            )
            results.append(result)
        
        serializer = ExamResultSerializer(results, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='results/bulk')
    def bulk_update_results(self, request, pk=None):
        exam = self.get_object()
        serializer = ExamResultBulkUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        results_data = serializer.validated_data['results']
        updated = 0
        
        with transaction.atomic():
            for result_data in results_data:
                result_id = result_data.get('result_id')
                try:
                    result = ExamResult.objects.get(id=result_id, exam=exam)
                except ExamResult.DoesNotExist:
                    continue
                
                is_absent = result_data.get('is_absent', result.is_absent)
                marks_obtained = result_data.get('marks_obtained')
                notes = result_data.get('notes', result.notes)
                
                if is_absent:
                    result.is_absent = True
                    result.marks_obtained = None
                    result.percentage = None
                else:
                    result.is_absent = False
                    if marks_obtained is not None:
                        result.marks_obtained = marks_obtained
                
                result.notes = notes
                result.save()
                updated += 1
        
        return Response({'updated': updated})

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        exam = self.get_object()
        results = ExamResult.objects.filter(exam=exam).select_related('student')
        
        attended = results.filter(is_absent=False)
        
        stats = {
            'total_students': exam.student_count,
            'attended': attended.count(),
            'absent': results.filter(is_absent=True).count(),
            'avg_percentage': round(attended.aggregate(Avg('percentage'))['percentage__avg'] or 0, 2),
        }
        
        ranked = []
        for idx, r in enumerate(attended.order_by('-percentage'), 1):
            ranked.append({
                'rank': idx,
                'student_id': r.student.student_id,
                'name': r.student.name,
                'marks': r.marks_obtained,
                'percentage': float(r.percentage),
            })
        
        serializer = ExamSummarySerializer({
            'exam': exam,
            'stats': stats,
            'ranked_students': ranked,
        })
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        exam = self.get_object()
        exam.is_published = True
        exam.save()
        
        return Response({
            'success': True,
            'message': 'Results published. Students can now view their results.'
        })

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        exams = self.queryset.filter(exam_date__gte=date.today(), is_published=False).order_by('exam_date')[:10]
        serializer = self.get_serializer(exams, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def student_exams(self, request):
        """Get exams for the logged-in student"""
        if request.user.role != 'student' or not request.user.student:
            return Response({'detail': 'Not a student account'}, status=status.HTTP_403_FORBIDDEN)
        
        student = request.user.student
        
        # Get exams for student's class and batch
        exams = Exam.objects.filter(
            exam_class=student.student_class,
            is_published=True
        ).filter(
            Q(batch__isnull=True) | Q(batch=student.batch)
        ).select_related('batch').prefetch_related('results').order_by('-exam_date')
        
        upcoming = []
        published = []
        
        for exam in exams:
            result = exam.results.filter(student=student).first()
            exam_data = {
                'id': exam.id,
                'name': exam.name,
                'exam_class': exam.exam_class,
                'total_marks': exam.total_marks,
                'exam_date': exam.exam_date,
                'is_published': exam.is_published,
                'is_upcoming': exam.exam_date >= date.today(),
                'result': None
            }
            
            if result:
                exam_data['result'] = {
                    'marks_obtained': result.marks_obtained,
                    'is_absent': result.is_absent,
                    'percentage': float(result.percentage) if result.percentage else None,
                    'rank': None,  # Could calculate rank if needed
                }
            
            if exam.exam_date >= date.today() and not exam.is_published:
                upcoming.append(exam_data)
            else:
                published.append(exam_data)
        
        return Response({
            'upcoming': upcoming,
            'published': published,
        })


class ExamResultViewSet(viewsets.ModelViewSet):
    queryset = ExamResult.objects.select_related('exam', 'student')
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = ['exam', 'student', 'is_absent']
    ordering = ['exam', 'student__student_class', 'student__roll']

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return ExamResultUpdateSerializer
        return ExamResultSerializer