from rest_framework import serializers
from .models import Student
from apps.batches.models import Batch
from apps.batches.serializers import BatchSerializer
from django.conf import settings


class StudentSerializer(serializers.ModelSerializer):
    batch = BatchSerializer(read_only=True)
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )
    unpaid_months_count = serializers.IntegerField(read_only=True)
    overall_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    student_class_display = serializers.CharField(source='get_student_class_display', read_only=True)

    class Meta:
        model = Student
        fields = [
            'id', 'student_id', 'name', 'phone', 'student_class', 'student_class_display',
            'roll', 'ssc_session', 'batch', 'batch_id', 'payment_start_month',
            'payment_start_year', 'address', 'parent_name', 'parent_phone',
            'date_added', 'is_active', 'unpaid_months_count', 'overall_percentage'
        ]
        read_only_fields = ['id', 'student_id', 'date_added', 'unpaid_months_count', 'overall_percentage']


class StudentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    batch = BatchSerializer(read_only=True)
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )
    student_class_display = serializers.CharField(source='get_student_class_display', read_only=True)

    class Meta:
        model = Student
        fields = [
            'id', 'student_id', 'name', 'phone', 'student_class', 'student_class_display',
            'roll', 'ssc_session', 'batch', 'batch_id', 'payment_start_month',
            'payment_start_year', 'is_active'
        ]


class StudentCreateSerializer(serializers.ModelSerializer):
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model = Student
        fields = [
            'name', 'phone', 'student_class', 'roll', 'ssc_session',
            'batch_id', 'payment_start_month', 'payment_start_year',
            'address', 'parent_name', 'parent_phone'
        ]

    def validate(self, data):
        student_class = data.get('student_class')
        batch = data.get('batch')
        
        if batch and batch.student_class != student_class:
            raise serializers.ValidationError("Batch must belong to the selected class.")
        
        return data


class StudentUpdateSerializer(serializers.ModelSerializer):
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model = Student
        fields = [
            'name', 'phone', 'student_class', 'roll', 'ssc_session',
            'batch_id', 'payment_start_month', 'payment_start_year',
            'address', 'parent_name', 'parent_phone', 'is_active'
        ]

    def validate(self, data):
        student_class = data.get('student_class', self.instance.student_class if self.instance else None)
        batch = data.get('batch', self.instance.batch if self.instance else None)
        
        if batch and batch.student_class != student_class:
            raise serializers.ValidationError("Batch must belong to the selected class.")
        
        return data


class StudentPasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(read_only=True)


class StudentSearchSerializer(serializers.ModelSerializer):
    """For search autocomplete"""
    batch = BatchSerializer(read_only=True)
    student_class_display = serializers.CharField(source='get_student_class_display', read_only=True)

    class Meta:
        model = Student
        fields = ['id', 'student_id', 'name', 'phone', 'student_class', 'student_class_display', 'batch']