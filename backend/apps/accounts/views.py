from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q
from django.utils import timezone
from datetime import date, datetime

from .models import User
from .serializers import (
    UserSerializer, TeacherLoginSerializer, TeacherAuthResponseSerializer,
    StudentLoginSerializer, StudentAuthResponseSerializer
)
from apps.students.models import Student
from apps.students.serializers import StudentSerializer
from apps.exams.models import Exam, ExamResult
from apps.payments.models import Payment
from apps.notices.models import Notice
from apps.homework.models import Homework

User = get_user_model()


class TeacherAuthViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'])
    def login(self, request):
        serializer = TeacherLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = authenticate(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password']
        )
        
        if not user or not user.is_staff or user.role != 'teacher':
            return Response(
                {'detail': 'Invalid credentials or not authorized'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })

    @action(detail=False, methods=['post'])
    def logout(self, request):
        return Response({'detail': 'Logged out successfully'})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        return Response(UserSerializer(request.user).data)


class StudentAuthViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'])
    def login(self, request):
        serializer = StudentLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            student = Student.objects.get(
                student_id=serializer.validated_data['student_id'],
                is_active=True
            )
        except Student.DoesNotExist:
            return Response(
                {'detail': 'Student not found'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if student.password != serializer.validated_data['password']:
            return Response(
                {'detail': 'Invalid password'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        user, created = User.objects.get_or_create(
            username=student.student_id,
            defaults={
                'role': 'student',
                'student': student,
            }
        )
        if not created and user.role != 'student':
            user.role = 'student'
            user.student = student
            user.save()
        
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'student': StudentSerializer(student).data
        })

    @action(detail=False, methods=['post'])
    def logout(self, request):
        return Response({'detail': 'Logged out successfully'})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        if request.user.role != 'student' or not request.user.student:
            return Response(
                {'detail': 'Not a student account'},
                status=status.HTTP_403_FORBIDDEN
            )
        return Response(StudentSerializer(request.user.student).data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def stats(self, request):
        if request.user.role != 'student' or not request.user.student:
            return Response({'detail': 'Not a student account'}, status=status.HTTP_403_FORBIDDEN)
        
        student = request.user.student
        
        # Overall performance
        results = ExamResult.objects.filter(student=student, is_absent=False)
        overall_pct = results.aggregate(Avg('percentage'))['percentage__avg'] or 0
        
        # Best rank
        best_rank = None
        for result in results.select_related('exam'):
            exam = result.exam
            attended = ExamResult.objects.filter(exam=exam, is_absent=False).order_by('-percentage')
            for idx, res in enumerate(attended, 1):
                if res.student_id == student.id:
                    if best_rank is None or idx < best_rank:
                        best_rank = idx
                    break
        
        # Recent performance
        recent_results = ExamResult.objects.filter(student=student).select_related('exam').order_by('-exam__date_created')[:5]
        recent_performance = []
        for r in recent_results:
            exam = r.exam
            attended = ExamResult.objects.filter(exam=exam, is_absent=False).order_by('-percentage')
            rank = 0
            for idx, res in enumerate(attended, 1):
                if res.student_id == student.id:
                    rank = idx
                    break
            recent_performance.append({
                'exam_name': exam.name,
                'exam_date': exam.exam_date,
                'percentage': float(r.percentage) if r.percentage else None,
                'rank': rank if rank > 0 else None,
                'total_students': attended.count(),
                'is_absent': r.is_absent,
            })
        
        # Unpaid count
        current_year = datetime.now().year
        current_month = datetime.now().month
        unpaid_count = Payment.objects.filter(
            student=student,
            year=current_year,
            month__lte=current_month,
            is_paid=False
        ).count()
        
        return Response({
            'total_exams': results.count(),
            'overall_percentage': round(overall_pct, 2),
            'best_rank': best_rank,
            'recent_performance': recent_performance,
            'unpaid_count': unpaid_count,
        })

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def performance(self, request):
        if request.user.role != 'student' or not request.user.student:
            return Response({'detail': 'Not a student account'}, status=status.HTTP_403_FORBIDDEN)
        
        student = request.user.student
        results = ExamResult.objects.filter(student=student).select_related('exam').order_by('-exam__date_created')
        
        performance_data = []
        for r in results:
            exam = r.exam
            attended = ExamResult.objects.filter(exam=exam, is_absent=False).order_by('-percentage')
            rank = 0
            for idx, res in enumerate(attended, 1):
                if res.student_id == student.id:
                    rank = idx
                    break
            performance_data.append({
                'exam_name': exam.name,
                'exam_date': exam.exam_date,
                'total_marks': exam.total_marks,
                'marks_obtained': r.marks_obtained,
                'is_absent': r.is_absent,
                'percentage': float(r.percentage) if r.percentage else None,
                'rank': rank if rank > 0 else None,
                'total_students': attended.count(),
            })
        
        return Response({'performance': performance_data})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def payments(self, request):
        if request.user.role != 'student' or not request.user.student:
            return Response({'detail': 'Not a student account'}, status=status.HTTP_403_FORBIDDEN)
        
        student = request.user.student
        year = int(request.query_params.get('year', datetime.now().year))
        
        payments = []
        start_month = student.payment_start_month
        start_year = student.payment_start_year
        
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        for y in range(start_year, current_year + 1):
            month_start = start_month if y == start_year else 1
            month_end = current_month if y == current_year else 12
            
            for month_num in range(month_start, month_end + 1):
                payment, created = Payment.objects.get_or_create(
                    student=student,
                    year=y,
                    month=month_num,
                    defaults={'amount': 1000, 'is_paid': False}
                )
                payments.append({
                    'month': payment.month,
                    'month_name': payment.month_name,
                    'year': payment.year,
                    'amount': float(payment.amount),
                    'is_paid': payment.is_paid,
                    'paid_date': payment.paid_date.isoformat() if payment.paid_date else None,
                })
        
        return Response({'payments': payments, 'year': year})