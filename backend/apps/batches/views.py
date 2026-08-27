from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count
from django.db import transaction

from .models import Batch
from .serializers import (
    BatchSerializer, BatchCreateSerializer, BatchStudentReassignSerializer
)
from apps.students.models import Student
from apps.students.serializers import StudentListSerializer
from apps.accounts.permissions import IsTeacher


class BatchViewSet(viewsets.ModelViewSet):
    queryset = Batch.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = ['student_class', 'is_active']
    search_fields = ['name']
    ordering_fields = ['student_class', 'name', 'created_at']
    ordering = ['student_class', 'name']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return BatchCreateSerializer
        return BatchSerializer

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        batch = self.get_object()
        students = batch.students.filter(is_active=True)
        serializer = StudentListSerializer(students, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def delete_with_reassign(self, request, pk=None):
        batch = self.get_object()
        serializer = BatchStudentReassignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_batch = serializer.validated_data.get('target_batch')
        new_batch_name = serializer.validated_data.get('new_batch_name')
        new_batch_description = serializer.validated_data.get('new_batch_description', '')

        with transaction.atomic():
            if new_batch_name:
                target_batch = Batch.objects.create(
                    name=new_batch_name,
                    student_class=batch.student_class,
                    description=new_batch_description,
                    is_active=True
                )
            
            if target_batch:
                Student.objects.filter(batch=batch).update(batch=target_batch)
            else:
                Student.objects.filter(batch=batch).update(batch=None)
            
            batch.is_active = False
            batch.save()

        return Response({'detail': 'Batch deleted and students reassigned'})

    @action(detail=False, methods=['get'])
    def by_class(self, request):
        student_class = request.query_params.get('class')
        if not student_class:
            return Response({'detail': 'class parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        batches = self.queryset.filter(student_class=student_class)
        serializer = self.get_serializer(batches, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        stats = Batch.objects.filter(is_active=True).values('student_class').annotate(
            count=Count('id')
        ).order_by('student_class')
        return Response(list(stats))