from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.db import transaction
from django.utils import timezone
from datetime import datetime

from .models import Payment
from .serializers import (
    PaymentSerializer, PaymentUpdateSerializer, PaymentStudentDetailSerializer,
    PaymentBulkUpdateSerializer, PaymentUnpaidStudentsSerializer
)
from apps.students.models import Student
from apps.accounts.permissions import IsTeacher


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('student', 'student__batch')
    permission_classes = [IsAuthenticated, IsTeacher]
    filterset_fields = ['student', 'year', 'month', 'is_paid']
    search_fields = ['student__name', 'student__student_id', 'student__phone']
    ordering_fields = ['year', 'month', 'student__name']
    ordering = ['-year', '-month', 'student__student_class', 'student__roll']

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return PaymentUpdateSerializer
        return PaymentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by student class
        student_class = self.request.query_params.get('class')
        if student_class:
            try:
                sc = int(student_class)
                queryset = queryset.filter(student__student_class=sc)
            except (ValueError, TypeError):
                return queryset.none()
        
        # Filter by batch
        batch_id = self.request.query_params.get('batch')
        if batch_id:
            try:
                bid = int(batch_id)
                queryset = queryset.filter(student__batch_id=bid)
            except (ValueError, TypeError):
                return queryset.none()
        
        return queryset

    @action(detail=False, methods=['get'])
    def student_detail(self, request):
        student_id = request.query_params.get('student_id')
        year_param = request.query_params.get('year', str(datetime.now().year))
        
        if not student_id:
            return Response({'detail': 'student_id required'}, status=status.HTTP_400_BAD_REQUEST)
        # Validate student_id is integer
        try:
            sid = int(student_id)
        except (ValueError, TypeError):
            return Response({'detail': 'Invalid student_id'}, status=status.HTTP_400_BAD_REQUEST)
        # Validate year
        try:
            year = int(year_param)
        except (ValueError, TypeError):
            return Response({'detail': 'Invalid year parameter'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            student = Student.objects.get(id=sid, is_active=True)
        except Student.DoesNotExist:
            return Response({'detail': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
        
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
                payments.append(payment)
        
        serializer = PaymentStudentDetailSerializer({
            'student': student,
            'payments': payments
        })
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        serializer = PaymentBulkUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        payment_ids = serializer.validated_data['payment_ids']
        is_paid = serializer.validated_data['is_paid']
        amount = serializer.validated_data.get('amount')
        notes = serializer.validated_data.get('notes', '')
        
        with transaction.atomic():
            payments = Payment.objects.filter(id__in=payment_ids)
            updated = 0
            for payment in payments:
                payment.is_paid = is_paid
                if amount is not None:
                    payment.amount = amount
                if is_paid and not payment.paid_date:
                    payment.paid_date = timezone.now()
                elif not is_paid:
                    payment.paid_date = None
                payment.notes = notes
                payment.save()
                updated += 1
        
        return Response({'updated': updated})

    @action(detail=False, methods=['get'])
    def unpaid_students(self, request):
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        student_class = request.query_params.get('class')
        batch_id = request.query_params.get('batch')
        
        students_with_unpaid = Student.objects.filter(
            is_active=True,
            payments__year=current_year,
            payments__month__lte=current_month,
            payments__is_paid=False
        ).distinct()
        
        if student_class:
            students_with_unpaid = students_with_unpaid.filter(student_class=student_class)
        if batch_id:
            students_with_unpaid = students_with_unpaid.filter(batch_id=batch_id)
        
        students_data = []
        for student in students_with_unpaid:
            unpaid_payments = Payment.objects.filter(
                student=student,
                year=current_year,
                month__lte=current_month,
                is_paid=False
            ).order_by('month')
            
            months = []
            for p in unpaid_payments:
                months.append({
                    'month': p.month,
                    'month_name': p.month_name,
                    'amount': float(p.amount),
                })
            
            students_data.append({
                'student_id': student.id,
                'student_code': student.student_id,
                'name': student.name,
                'phone': student.phone,
                'student_class': student.student_class,
                'batch': student.batch.display_name if student.batch else None,
                'unpaid_months': months,
                'unpaid_count': len(months),
            })
        
        return Response({'unpaid_students': students_data})

    @action(detail=False, methods=['post'])
    def notify_unpaid(self, request):
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        student_class = request.data.get('class')
        batch_id = request.data.get('batch')
        
        unpaid = Payment.objects.filter(
            year=current_year,
            month__lte=current_month,
            is_paid=False,
            student__is_active=True
        ).select_related('student', 'student__batch')
        
        if student_class:
            unpaid = unpaid.filter(student__student_class=student_class)
        if batch_id:
            unpaid = unpaid.filter(student__batch_id=batch_id)
        
        results = []
        for payment in unpaid:
            student = payment.student
            result = f"[PSEUDO] Would send SMS to {student.phone} for {payment.month_name} {payment.year}"
            results.append({
                'student': student.name,
                'phone': student.phone,
                'month': payment.month_name,
                'year': payment.year,
                'amount': float(payment.amount),
                'result': result
            })
        
        return Response({'success': True, 'results': results})

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '').strip()
        student_class = request.query_params.get('class')
        batch_id = request.query_params.get('batch')
        
        if query:
            students = Student.objects.filter(
                Q(name__icontains=query) | Q(student_id__icontains=query) | Q(phone__icontains=query),
                is_active=True
            )
            if student_class:
                students = students.filter(student_class=student_class)
            if batch_id:
                students = students.filter(batch_id=batch_id)
            students = students.select_related('batch')[:20]
        else:
            students = Student.objects.filter(is_active=True)
            if student_class:
                students = students.filter(student_class=student_class)
            if batch_id:
                students = students.filter(batch_id=batch_id)
            students = students.select_related('batch')[:20]
        
        data = [{
            'id': s.id,
            'student_id': s.student_id,
            'name': s.name,
            'phone': s.phone,
            'student_class': s.student_class,
            'batch': {'id': s.batch.id, 'display_name': s.batch.display_name} if s.batch else None,
        } for s in students]
        return Response({'students': data})

    @action(detail=False, methods=['get'])
    def years(self, request):
        years = Payment.objects.values_list('year', flat=True).distinct().order_by('-year')
        current_year = datetime.now().year
        year_list = list(years)
        if current_year not in year_list:
            year_list.append(current_year)
        year_list.sort(reverse=True)
        return Response({'years': year_list})