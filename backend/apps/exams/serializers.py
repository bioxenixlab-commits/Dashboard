from rest_framework import serializers
from .models import Exam, ExamResult
from apps.batches.models import Batch
from apps.students.serializers import StudentListSerializer
from apps.batches.serializers import BatchSerializer
from django.conf import settings


class ExamSerializer(serializers.ModelSerializer):
    batch = BatchSerializer(read_only=True)
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )
    student_count = serializers.IntegerField(read_only=True)
    results_entered_count = serializers.IntegerField(read_only=True)
    exam_class_display = serializers.CharField(source='get_exam_class_display', read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)

    class Meta:
        model = Exam
        fields = [
            'id', 'name', 'exam_class', 'exam_class_display', 'batch', 'batch_id',
            'total_marks', 'description', 'date_created', 'exam_date',
            'is_published', 'student_count', 'results_entered_count', 'is_upcoming'
        ]
        read_only_fields = ['id', 'date_created', 'student_count', 'results_entered_count', 'is_upcoming']


class ExamCreateSerializer(serializers.ModelSerializer):
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model = Exam
        fields = ['name', 'exam_class', 'batch_id', 'total_marks', 'description', 'exam_date']

    def validate(self, data):
        exam_class = data.get('exam_class')
        batch = data.get('batch')
        
        if batch and batch.student_class != exam_class:
            raise serializers.ValidationError("Batch must belong to the selected class.")
        
        return data


class ExamResultSerializer(serializers.ModelSerializer):
    student = StudentListSerializer(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=ExamResult.objects.none(),
        source='student',
        write_only=True
    )
    exam = ExamSerializer(read_only=True)
    exam_id = serializers.PrimaryKeyRelatedField(
        queryset=Exam.objects.all(),
        source='exam',
        write_only=True
    )

    class Meta:
        model = ExamResult
        fields = ['id', 'exam', 'exam_id', 'student', 'student_id', 'marks_obtained', 'is_absent', 'percentage', 'date_recorded', 'notes']
        read_only_fields = ['id', 'date_recorded', 'percentage']


class ExamResultUpdateSerializer(serializers.ModelSerializer):
    marks_obtained = serializers.IntegerField(required=False, allow_null=True, min_value=0)

    class Meta:
        model = ExamResult
        fields = ['marks_obtained', 'is_absent', 'notes']

    def validate_marks_obtained(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Marks cannot be negative.")
        return value

    def validate(self, data):
        marks = data.get('marks_obtained', self.instance.marks_obtained if self.instance else None)
        is_absent = data.get('is_absent', self.instance.is_absent if self.instance else False)
        if not is_absent and marks is not None and self.instance:
            if marks > self.instance.exam.total_marks:
                raise serializers.ValidationError({'marks_obtained': f'Marks cannot exceed total marks ({self.instance.exam.total_marks}).'})
        return data

    def update(self, instance, validated_data):
        is_absent = validated_data.get('is_absent', instance.is_absent)
        marks_obtained = validated_data.get('marks_obtained', instance.marks_obtained)
        
        if is_absent:
            instance.marks_obtained = None
            instance.percentage = None
        elif marks_obtained is not None:
            if marks_obtained > instance.exam.total_marks:
                raise serializers.ValidationError({'marks_obtained': f'Marks cannot exceed total marks ({instance.exam.total_marks}).'})
            instance.marks_obtained = marks_obtained
            instance.percentage = round((marks_obtained / instance.exam.total_marks) * 100, 2)
        
        return super().update(instance, validated_data)


class ExamResultBulkUpdateSerializer(serializers.Serializer):
    results = serializers.ListField(child=serializers.DictField(), max_length=100, allow_empty=False)

    def validate_results(self, value):
        if len(value) > 100:
            raise serializers.ValidationError("Too many results (max 100).")
        for idx, item in enumerate(value):
            if 'result_id' not in item:
                raise serializers.ValidationError(f"Item {idx}: result_id is required.")
            try:
                int(item['result_id'])
            except (ValueError, TypeError):
                raise serializers.ValidationError(f"Item {idx}: result_id must be an integer.")
            if 'marks_obtained' in item and item['marks_obtained'] is not None:
                try:
                    m = int(item['marks_obtained'])
                    if m < 0:
                        raise serializers.ValidationError(f"Item {idx}: marks_obtained cannot be negative.")
                except (ValueError, TypeError):
                    raise serializers.ValidationError(f"Item {idx}: marks_obtained must be an integer.")
            if 'is_absent' in item and not isinstance(item['is_absent'], bool):
                # allow 0/1 as bool is common, but enforce bool
                if item['is_absent'] not in [True, False, 0, 1]:
                    raise serializers.ValidationError(f"Item {idx}: is_absent must be boolean.")
        return value


class ExamDetailSerializer(serializers.ModelSerializer):
    batch = BatchSerializer(read_only=True)
    exam_class_display = serializers.CharField(source='get_exam_class_display', read_only=True)
    results = ExamResultSerializer(many=True, read_only=True)

    class Meta:
        model = Exam
        fields = [
            'id', 'name', 'exam_class', 'exam_class_display', 'batch',
            'total_marks', 'description', 'exam_date', 'is_published', 'results'
        ]


class ExamSummarySerializer(serializers.Serializer):
    exam = ExamSerializer()
    stats = serializers.DictField()
    ranked_students = serializers.ListField(child=serializers.DictField())


class ExamPublishSerializer(serializers.Serializer):
    pass