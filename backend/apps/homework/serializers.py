from rest_framework import serializers
from django.utils import timezone
from .models import Homework, HomeworkSubmission
from apps.batches.models import Batch
from apps.batches.serializers import BatchSerializer
from apps.students.serializers import StudentListSerializer
from django.conf import settings


class HomeworkSerializer(serializers.ModelSerializer):
    batch = BatchSerializer(read_only=True)
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )
    student_class_display = serializers.CharField(source='get_student_class_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    submission_count = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Homework
        fields = [
            'id', 'title', 'description', 'student_class', 'student_class_display',
            'batch', 'batch_id', 'assigned_date', 'due_date', 'priority',
            'is_active', 'created_by', 'created_by_name', 'created_at',
            'updated_at', 'submission_count', 'is_overdue'
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at', 'updated_at', 'submission_count', 'is_overdue']

    def get_submission_count(self, obj):
        return obj.submissions.count()

    def get_is_overdue(self, obj):
        from datetime import date
        return obj.due_date < date.today() and obj.is_active


class HomeworkCreateSerializer(serializers.ModelSerializer):
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model = Homework
        fields = ['title', 'description', 'student_class', 'batch_id', 'assigned_date', 'due_date', 'priority', 'is_active']

    def validate(self, data):
        student_class = data.get('student_class')
        batch = data.get('batch')
        
        if batch and batch.student_class != student_class:
            raise serializers.ValidationError("Batch must belong to the selected class.")
        
        assigned_date = data.get('assigned_date')
        due_date = data.get('due_date')
        if due_date and assigned_date and due_date < assigned_date:
            raise serializers.ValidationError("Due date cannot be before assigned date.")
        
        return data


class HomeworkStudentSerializer(serializers.ModelSerializer):
    """Lightweight serializer for student dashboard"""
    batch = BatchSerializer(read_only=True)
    student_class_display = serializers.CharField(source='get_student_class_display', read_only=True)
    is_overdue = serializers.SerializerMethodField()
    submission_status = serializers.SerializerMethodField()

    class Meta:
        model = Homework
        fields = [
            'id', 'title', 'description', 'student_class', 'student_class_display',
            'batch', 'assigned_date', 'due_date', 'priority', 'is_overdue', 'submission_status'
        ]

    def get_is_overdue(self, obj):
        from datetime import date
        return obj.due_date < date.today() and obj.is_active

    def get_submission_status(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'student'):
            submission = obj.submissions.filter(student=request.student).first()
            if submission:
                return submission.status
        return 'pending'


class HomeworkSubmissionSerializer(serializers.ModelSerializer):
    student = StudentListSerializer(read_only=True)
    homework = HomeworkSerializer(read_only=True)
    graded_by_name = serializers.CharField(source='graded_by.get_full_name', read_only=True)

    class Meta:
        model = HomeworkSubmission
        fields = [
            'id', 'homework', 'student', 'content', 'attachment',
            'status', 'submitted_at', 'graded_at', 'marks',
            'feedback', 'graded_by', 'graded_by_name'
        ]
        read_only_fields = ['id', 'student', 'homework', 'submitted_at', 'graded_at', 'graded_by', 'graded_by_name', 'marks', 'feedback', 'status']

    def validate(self, data):
        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) == 'student':
            # Students must not modify grading fields via generic update
            forbidden = {'marks', 'feedback', 'graded_by', 'graded_at', 'status'}
            if any(f in data for f in forbidden):
                raise serializers.ValidationError("Students cannot modify grading fields.")
        return data


class HomeworkSubmissionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomeworkSubmission
        fields = ['content', 'attachment']

    def validate_attachment(self, value):
        if not value:
            return value
        # Validate extension
        import os
        from apps.homework.models import ALLOWED_ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_SIZE
        ext = os.path.splitext(value.name)[1].lower().lstrip('.')
        if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
            raise serializers.ValidationError(f"File type '.{ext}' not allowed. Allowed: {', '.join(ALLOWED_ATTACHMENT_EXTENSIONS)}")
        if value.size > MAX_ATTACHMENT_SIZE:
            raise serializers.ValidationError(f"File too large (max 10 MB).")
        # MIME check via magic bytes for images/pdf
        # Basic content-type check: ensure not executable
        dangerous = ['exe', 'sh', 'php', 'html', 'htm', 'svg', 'js']
        if ext in dangerous:
            raise serializers.ValidationError("Dangerous file type not allowed.")
        # Check filename for path traversal
        if '..' in value.name or '/' in value.name or '\\' in value.name:
            # Django will sanitize, but explicitly reject suspicious names
            # Allow only basename; still check
            if '..' in value.name:
                raise serializers.ValidationError("Invalid filename.")
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        homework = self.context.get('homework')
        validated_data['student'] = request.student
        validated_data['homework'] = homework
        validated_data['status'] = 'submitted'
        validated_data['submitted_at'] = timezone.now()
        return super().create(validated_data)


class HomeworkSubmissionGradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomeworkSubmission
        fields = ['marks', 'feedback', 'status']

    def update(self, instance, validated_data):
        request = self.context.get('request')
        if 'marks' in validated_data or 'feedback' in validated_data:
            instance.graded_by = request.user
            instance.graded_at = timezone.now()
            instance.status = 'graded'
        return super().update(instance, validated_data)