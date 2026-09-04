from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from django.db import transaction

from .models import Student, School
from .serializers import (
    StudentSerializer, StudentListSerializer, StudentCreateSerializer,
    StudentUpdateSerializer, StudentPasswordResetSerializer, StudentSearchSerializer,
    SchoolSerializer
)
from apps.batches.models import Batch
from apps.accounts.permissions import IsTeacher


class SchoolViewSet(viewsets.ModelViewSet):
    queryset = School.objects.all()
    serializer_class = SchoolSerializer
    permission_classes = [IsAuthenticated, IsTeacher]
    search_fields = ['name']
    ordering = ['name']
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.filter(is_active=True).select_related('batch', 'school')
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = ['student_class', 'batch', 'school', 'is_active']
    search_fields = ['name', 'student_id', 'phone', 'parent_name', 'parent_phone', 'school__name']
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
        
        # Filter by class (validate integer, ignore invalid to avoid 500)
        student_class = self.request.query_params.get('class')
        if student_class:
            try:
                sc = int(student_class)
                queryset = queryset.filter(student_class=sc)
            except (ValueError, TypeError):
                return queryset.none()
        
        # Filter by batch
        batch_id = self.request.query_params.get('batch')
        if batch_id:
            try:
                bid = int(batch_id)
                queryset = queryset.filter(batch_id=bid)
            except (ValueError, TypeError):
                return queryset.none()

        # Filter by school
        school_id = self.request.query_params.get('school')
        if school_id:
            try:
                sid = int(school_id)
                queryset = queryset.filter(school_id=sid)
            except (ValueError, TypeError):
                return queryset.none()
        
        # Global search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(student_id__icontains=search) |
                Q(phone__icontains=search) |
                Q(school__name__icontains=search)
            )
        
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Generate secure temporary password for new student
        temp_student = Student(**{k: v for k, v in serializer.validated_data.items() if k not in ('batch', 'school')})
        # Handle batch/school separately if present
        raw = temp_student.generate_password()
        student = serializer.save()
        student.set_student_password(raw)
        student.save(update_fields=['password'])
        headers = self.get_success_headers(serializer.data)
        data = StudentSerializer(student).data
        data['new_password'] = raw
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        student = self.get_object()
        raw = student.generate_password()
        student.set_student_password(raw)
        student.save(update_fields=['password'])
        return Response({'new_password': raw})

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
        if not isinstance(ids, list):
            return Response({'detail': 'ids must be a list'}, status=status.HTTP_400_BAD_REQUEST)
        if len(ids) > 100:
            return Response({'detail': 'Too many IDs (max 100)'}, status=status.HTTP_400_BAD_REQUEST)
        if len(ids) == 0:
            return Response({'detail': 'ids list is empty'}, status=status.HTTP_400_BAD_REQUEST)
        # Validate all are ints
        try:
            ids = [int(i) for i in ids]
        except (ValueError, TypeError):
            return Response({'detail': 'Invalid IDs'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            Student.objects.filter(id__in=ids).update(is_active=False)
        return Response({'detail': f'{len(ids)} students deactivated'})

    @action(detail=False, methods=['post'])
    def bulk_update_batch(self, request):
        ids = request.data.get('ids', [])
        if not isinstance(ids, list):
            return Response({'detail': 'ids must be a list'}, status=status.HTTP_400_BAD_REQUEST)
        if len(ids) > 100:
            return Response({'detail': 'Too many IDs (max 100)'}, status=status.HTTP_400_BAD_REQUEST)
        if len(ids) == 0:
            return Response({'detail': 'ids list is empty'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ids = [int(i) for i in ids]
        except (ValueError, TypeError):
            return Response({'detail': 'Invalid IDs'}, status=status.HTTP_400_BAD_REQUEST)
        batch_id = request.data.get('batch_id')
        
        if batch_id:
            try:
                batch = Batch.objects.get(id=batch_id, is_active=True)
            except Batch.DoesNotExist:
                return Response({'detail': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            batch = None
        
        with transaction.atomic():
            updated = Student.objects.filter(id__in=ids).update(batch=batch)
        return Response({'detail': f'{updated} students updated'})