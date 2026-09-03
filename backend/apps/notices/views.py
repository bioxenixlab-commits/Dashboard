from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone

from .models import Notice
from .serializers import NoticeSerializer, NoticeCreateSerializer, NoticeStudentSerializer
from apps.accounts.permissions import IsTeacher


class NoticeViewSet(viewsets.ModelViewSet):
    queryset = Notice.objects.select_related('batch', 'created_by').filter(is_active=True)
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = ['student_class', 'batch', 'priority', 'is_active']
    search_fields = ['title', 'content']
    ordering_fields = ['created_at', 'priority', 'expires_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return NoticeCreateSerializer
        return NoticeSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        student_class = self.request.query_params.get('class')
        if student_class:
            try:
                sc = int(student_class)
                queryset = queryset.filter(student_class=sc)
            except (ValueError, TypeError):
                return queryset.none()
        
        batch_id = self.request.query_params.get('batch')
        if batch_id:
            try:
                bid = int(batch_id)
                queryset = queryset.filter(batch_id=bid)
            except (ValueError, TypeError):
                return queryset.none()
        
        show_expired = self.request.query_params.get('show_expired', 'false').lower() == 'true'
        if not show_expired:
            queryset = queryset.filter(
                Q(expires_at__isnull=True) | Q(expires_at__gte=timezone.now())
            )
        
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def student_notices(self, request):
        """Get notices for the logged-in student"""
        if request.user.role != 'student' or not request.user.student:
            return Response({'detail': 'Not a student account'}, status=status.HTTP_403_FORBIDDEN)
        
        student = request.user.student
        notices = Notice.objects.filter(
            Q(student_class__isnull=True) | Q(student_class=student.student_class),
            is_active=True
        ).filter(
            Q(batch__isnull=True) | Q(batch=student.batch)
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gte=timezone.now())
        ).select_related('batch').order_by('-priority', '-created_at')
        
        serializer = NoticeStudentSerializer(notices, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_class(self, request):
        student_class = request.query_params.get('class')
        if not student_class:
            return Response({'detail': 'class parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        notices = self.queryset.filter(student_class=student_class)
        serializer = self.get_serializer(notices, many=True)
        return Response(serializer.data)