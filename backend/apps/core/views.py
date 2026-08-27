from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Avg, Q
from django.utils import timezone
from datetime import date, datetime

from apps.students.models import Student
from apps.exams.models import Exam, ExamResult
from apps.payments.models import Payment
from apps.notices.models import Notice
from apps.homework.models import Homework
from apps.attendance.models import Attendance
from apps.batches.models import Batch
from apps.accounts.permissions import IsTeacher


class StatsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsTeacher]

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        # Total students
        total_students = Student.objects.filter(is_active=True).count()

        # Total exams
        total_exams = Exam.objects.count()

        # Students with unpaid fees (current month)
        current_year = datetime.now().year
        current_month = datetime.now().month
        unpaid_count = Student.objects.filter(
            is_active=True,
            payments__year=current_year,
            payments__month__lte=current_month,
            payments__is_paid=False
        ).distinct().count()

        # Total active batches
        total_batches = Batch.objects.filter(is_active=True).count()

        # Upcoming exams
        upcoming_exams = Exam.objects.filter(
            exam_date__gte=date.today(),
            is_published=False
        ).count()

        # Active notices
        active_notices = Notice.objects.filter(
            is_active=True
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gte=timezone.now())
        ).count()

        # Pending homework
        pending_homework = Homework.objects.filter(
            is_active=True,
            due_date__gte=date.today()
        ).count()

        # Today's attendance stats
        today_attendance = Attendance.objects.filter(date=date.today())
        attendance_present = today_attendance.filter(status='present').count()
        attendance_absent = today_attendance.filter(status='absent').count()

        return Response({
            'total_students': total_students,
            'total_exams': total_exams,
            'unpaid_count': unpaid_count,
            'total_batches': total_batches,
            'upcoming_exams': upcoming_exams,
            'active_notices': active_notices,
            'pending_homework': pending_homework,
            'attendance_today': {
                'present': attendance_present,
                'absent': attendance_absent,
                'total': attendance_present + attendance_absent,
            }
        })