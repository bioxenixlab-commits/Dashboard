from rest_framework import serializers
from .models import Notice
from apps.batches.models import Batch
from apps.batches.serializers import BatchSerializer
from django.conf import settings


class NoticeSerializer(serializers.ModelSerializer):
    batch = BatchSerializer(read_only=True)
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )
    student_class_display = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notice
        fields = [
            'id', 'title', 'content', 'student_class', 'student_class_display',
            'batch', 'batch_id', 'priority', 'is_active', 'created_by',
            'created_by_name', 'created_at', 'updated_at', 'expires_at', 'is_expired'
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at', 'updated_at', 'is_expired']

    def get_student_class_display(self, obj):
        if obj.student_class is None:
            return "All Classes"
        return obj.get_student_class_display()


class NoticeCreateSerializer(serializers.ModelSerializer):
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )
    student_class = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = Notice
        fields = ['title', 'content', 'student_class', 'batch_id', 'priority', 'is_active', 'expires_at']

    def validate(self, data):
        student_class = data.get('student_class')
        batch = data.get('batch')
        
        if student_class is None and batch is not None:
            raise serializers.ValidationError("Cannot select a batch when 'All Classes' is selected. Choose a specific class or 'All Batches'.")
        if batch and student_class is not None and batch.student_class != student_class:
            raise serializers.ValidationError("Batch must belong to the selected class.")
        
        return data


class NoticeStudentSerializer(serializers.ModelSerializer):
    """Lightweight serializer for student dashboard"""
    batch = BatchSerializer(read_only=True)
    student_class_display = serializers.SerializerMethodField()

    class Meta:
        model = Notice
        fields = ['id', 'title', 'content', 'student_class', 'student_class_display', 'batch', 'priority', 'created_at', 'expires_at']

    def get_student_class_display(self, obj):
        if obj.student_class is None:
            return "All Classes"
        return obj.get_student_class_display()