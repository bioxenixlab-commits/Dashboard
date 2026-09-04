from rest_framework import serializers
from .models import Student, School
from apps.batches.models import Batch
from apps.batches.serializers import BatchSerializer
from django.conf import settings


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class StudentSerializer(serializers.ModelSerializer):
    batch = BatchSerializer(read_only=True)
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )
    school = SchoolSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(
        queryset=School.objects.all(),
        source='school',
        write_only=True,
        required=False,
        allow_null=True
    )
    school_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    unpaid_months_count = serializers.IntegerField(read_only=True)
    overall_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    student_class_display = serializers.CharField(source='get_student_class_display', read_only=True)

    class Meta:
        model = Student
        fields = [
            'id', 'student_id', 'name', 'phone', 'student_class', 'student_class_display',
            'roll', 'ssc_session', 'batch', 'batch_id', 'school', 'school_id', 'school_name',
            'payment_start_month', 'payment_start_year', 'address', 'parent_name', 'parent_phone',
            'date_added', 'is_active', 'unpaid_months_count', 'overall_percentage'
        ]
        read_only_fields = ['id', 'student_id', 'date_added', 'unpaid_months_count', 'overall_percentage']

    def _handle_school_name(self, validated_data):
        # If school_name provided and no explicit school_id, get_or_create school
        school_name = validated_data.pop('school_name', None)
        if school_name:
            school_name = school_name.strip()
            if school_name:
                school, _ = School.objects.get_or_create(name=school_name)
                validated_data['school'] = school
        return validated_data

    def create(self, validated_data):
        validated_data = self._handle_school_name(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._handle_school_name(validated_data)
        return super().update(instance, validated_data)


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
    school = SchoolSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(
        queryset=School.objects.all(),
        source='school',
        write_only=True,
        required=False,
        allow_null=True
    )
    student_class_display = serializers.CharField(source='get_student_class_display', read_only=True)

    class Meta:
        model = Student
        fields = [
            'id', 'student_id', 'name', 'phone', 'student_class', 'student_class_display',
            'roll', 'ssc_session', 'batch', 'batch_id', 'school', 'school_id',
            'payment_start_month', 'payment_start_year', 'is_active'
        ]


class StudentCreateSerializer(serializers.ModelSerializer):
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )
    school_id = serializers.PrimaryKeyRelatedField(
        queryset=School.objects.all(),
        source='school',
        write_only=True,
        required=False,
        allow_null=True
    )
    school_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Student
        fields = [
            'name', 'phone', 'student_class', 'roll', 'ssc_session',
            'batch_id', 'school_id', 'school_name',
            'payment_start_month', 'payment_start_year',
            'address', 'parent_name', 'parent_phone'
        ]

    def validate(self, data):
        student_class = data.get('student_class')
        batch = data.get('batch')
        
        if batch and batch.student_class != student_class:
            raise serializers.ValidationError("Batch must belong to the selected class.")
        
        return data

    def _handle_school_name(self, validated_data):
        school_name = validated_data.pop('school_name', None)
        if school_name:
            school_name = school_name.strip()
            if school_name:
                school, _ = School.objects.get_or_create(name=school_name)
                validated_data['school'] = school
        return validated_data

    def create(self, validated_data):
        validated_data = self._handle_school_name(validated_data)
        return super().create(validated_data)


class StudentUpdateSerializer(serializers.ModelSerializer):
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )
    school_id = serializers.PrimaryKeyRelatedField(
        queryset=School.objects.all(),
        source='school',
        write_only=True,
        required=False,
        allow_null=True
    )
    school_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Student
        fields = [
            'name', 'phone', 'student_class', 'roll', 'ssc_session',
            'batch_id', 'school_id', 'school_name',
            'payment_start_month', 'payment_start_year',
            'address', 'parent_name', 'parent_phone', 'is_active'
        ]

    def validate(self, data):
        student_class = data.get('student_class', self.instance.student_class if self.instance else None)
        batch = data.get('batch', self.instance.batch if self.instance else None)
        
        if batch and batch.student_class != student_class:
            raise serializers.ValidationError("Batch must belong to the selected class.")
        
        return data

    def _handle_school_name(self, validated_data):
        school_name = validated_data.pop('school_name', None)
        if school_name:
            school_name = school_name.strip()
            if school_name:
                school, _ = School.objects.get_or_create(name=school_name)
                validated_data['school'] = school
        return validated_data

    def update(self, instance, validated_data):
        validated_data = self._handle_school_name(validated_data)
        return super().update(instance, validated_data)


class StudentPasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(read_only=True)


class StudentSearchSerializer(serializers.ModelSerializer):
    """For search autocomplete"""
    batch = BatchSerializer(read_only=True)
    school = SchoolSerializer(read_only=True)
    student_class_display = serializers.CharField(source='get_student_class_display', read_only=True)

    class Meta:
        model = Student
        fields = ['id', 'student_id', 'name', 'phone', 'student_class', 'student_class_display', 'batch', 'school']