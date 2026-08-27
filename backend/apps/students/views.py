from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from django.db import transaction

from .models import Student
from .serializers import (
    StudentSerializer, StudentListSerializer, StudentCreateSerializer,
    StudentUpdateSerializer, StudentPasswordResetSerializer, StudentSearchSerializer
)
from apps.batches.models import Batch
from apps.accounts.permissions import IsTeacher


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.filter(is_active=True).select_related('batch')
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = ['student_class', 'batch', 'is_active']
    search_fields = ['name', 'student_id', 'phone', 'parent_name', 'parent_phone']
    ordering_fields = ['student_class', 'roll', 'name', 'date_added']
    ordering = ['student_class', 'roll']

    def get_serializer_class(self):
        if self.action == 'list':
            return StudentListSerializer
        elif self.action == 'create':
            return StudentCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return StudentUpdateSerializer
        return StudentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by class
        student_class = self.request.query_params.get('class')
        if student_class:
            queryset = queryset.filter(student_class=student_class)
        
        # Filter by batch
        batch_id = self.request.query_params.get('batch')
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        
        # Global search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(student_id__icontains=search) |
                Q(phone__icontains=search)
            )
        
        return queryset

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        student = self.get_object()
        student.password = student.generate_password()
        student.save()
        return Response({'new_password': student.password})

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '').strip()
        student_class = request.query_params.get('class')
        batch_id = request.query_params.get('batch')
        
        queryset = Student.objects.filter(is_active=True)
        
        if query:
            queryset = queryset.filter(
                Q(name__icontains=query) |
                Q(student_id__icontains=query) |
                Q(phone__icontains=query)
            )
        
        if student_class:
            queryset = queryset.filter(student_class=student_class)
        
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        
        queryset = queryset[:20]
        serializer = StudentSearchSerializer(queryset, many=True)
        return Response({'students': serializer.data})

    @action(detail=True, methods=['get'])
    def detail(self, request, pk=None):
        student = self.get_object()
        serializer = StudentSerializer(student)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = Student.objects.filter(is_active=True).count()
        by_class = Student.objects.filter(is_active=True).values('student_class').annotate(
            count=Count('id')
        ).order_by('student_class')
        return Response({
            'total': total,
            'by_class': list(by_class)
        })

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        Student.objects.filter(id__in=ids).update(is_active=False)
        return Response({'detail': f'{len(ids)} students deactivated'})

    @action(detail=False, methods=['post'])
    def bulk_update_batch(self, request):
        ids = request.data.get('ids', [])
        batch_id = request.data.get('batch_id')
        
        if batch_id:
            try:
                batch = Batch.objects.get(id=batch_id, is_active=True)
            except Batch.DoesNotExist:
                return Response({'detail': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            batch = None
        
        updated = Student.objects.filter(id__in=ids).update(batch=batch)
        return Response({'detail': f'{updated} students updated'})