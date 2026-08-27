from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone
from datetime import date

from .models import Homework, HomeworkSubmission
from .serializers import (
    HomeworkSerializer, HomeworkCreateSerializer, HomeworkStudentSerializer,
    HomeworkSubmissionSerializer, HomeworkSubmissionCreateSerializer,
    HomeworkSubmissionGradeSerializer
)
from apps.students.models import Student
from apps.accounts.permissions import IsTeacher


class HomeworkViewSet(viewsets.ModelViewSet):
    queryset = Homework.objects.select_related('batch', 'created_by').filter(is_active=True)
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = ['student_class', 'batch', 'priority', 'is_active']
    search_fields = ['title', 'description']
    ordering_fields = ['assigned_date', 'due_date', 'created_at']
    ordering = ['-assigned_date']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return HomeworkCreateSerializer
        return HomeworkSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        student_class = self.request.query_params.get('class')
        if student_class:
            queryset = queryset.filter(student_class=student_class)
        
        batch_id = self.request.query_params.get('batch')
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def student_homework(self, request):
        """Get homework for the logged-in student"""
        if request.user.role != 'student' or not request.user.student:
            return Response({'detail': 'Not a student account'}, status=status.HTTP_403_FORBIDDEN)
        
        student = request.user.student
        homework = Homework.objects.filter(
            student_class=student.student_class,
            is_active=True
        ).filter(
            Q(batch__isnull=True) | Q(batch=student.batch)
        ).select_related('batch').order_by('due_date')
        
        serializer = HomeworkStudentSerializer(homework, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def submissions(self, request, pk=None):
        homework = self.get_object()
        submissions = homework.submissions.select_related('student', 'graded_by').all()
        serializer = HomeworkSubmissionSerializer(submissions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def grade_submission(self, request, pk=None):
        homework = self.get_object()
        student_id = request.data.get('student_id')
        
        if not student_id:
            return Response({'detail': 'student_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            submission = homework.submissions.get(student_id=student_id)
        except HomeworkSubmission.DoesNotExist:
            return Response({'detail': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = HomeworkSubmissionGradeSerializer(submission, data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(HomeworkSubmissionSerializer(submission).data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        homework = self.queryset.filter(due_date__gte=date.today()).order_by('due_date')[:10]
        serializer = self.get_serializer(homework, many=True)
        return Response(serializer.data)


class HomeworkSubmissionViewSet(viewsets.ModelViewSet):
    queryset = HomeworkSubmission.objects.select_related('homework', 'student', 'graded_by')
    permission_classes = [IsAuthenticated]
    filterset_fields = ['homework', 'student', 'status']
    ordering = ['-submitted_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return HomeworkSubmissionCreateSerializer
        return HomeworkSubmissionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        if self.request.user.role == 'student' and self.request.user.student:
            queryset = queryset.filter(student=self.request.user.student)
        
        return queryset

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def submit(self, request):
        """Submit homework for the current student"""
        if request.user.role != 'student' or not request.user.student:
            return Response({'detail': 'Not a student account'}, status=status.HTTP_403_FORBIDDEN)
        
        homework_id = request.data.get('homework_id')
        if not homework_id:
            return Response({'detail': 'homework_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            homework = Homework.objects.get(id=homework_id, is_active=True)
        except Homework.DoesNotExist:
            return Response({'detail': 'Homework not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if student is eligible for this homework
        if homework.student_class != request.user.student.student_class:
            return Response({'detail': 'Not eligible for this homework'}, status=status.HTTP_403_FORBIDDEN)
        if homework.batch and homework.batch != request.user.student.batch:
            return Response({'detail': 'Not eligible for this homework'}, status=status.HTTP_403_FORBIDDEN)
        
        submission, created = HomeworkSubmission.objects.get_or_create(
            homework=homework,
            student=request.user.student,
            defaults={
                'content': request.data.get('content', ''),
                'status': 'submitted',
                'submitted_at': timezone.now(),
            }
        )
        
        if not created:
            submission.content = request.data.get('content', submission.content)
            submission.status = 'submitted'
            submission.submitted_at = timezone.now()
            if 'attachment' in request.FILES:
                submission.attachment = request.FILES['attachment']
            submission.save()
        
        serializer = HomeworkSubmissionSerializer(submission)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)