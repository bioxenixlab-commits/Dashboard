from rest_framework import serializers
from .models import Attendance, AttendanceSession
from apps.batches.models import Batch
from apps.students.serializers import StudentListSerializer
from apps.batches.serializers import BatchSerializer
from django.conf import settings
from datetime import date


class AttendanceSerializer(serializers.ModelSerializer):
    student = StudentListSerializer(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=Attendance.objects.none(),
        source='student',
        write_only=True
    )
    recorded_by_name = serializers.CharField(source='recorded_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Attendance
        fields = ['id', 'student', 'student_id', 'date', 'status', 'status_display', 'notes', 'recorded_by', 'recorded_by_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'recorded_by', 'recorded_by_name', 'created_at', 'updated_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'student_id' in self.fields:
            from apps.students.models import Student
            self.fields['student_id'].queryset = Student.objects.filter(is_active=True)


class AttendanceCreateSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=settings.ATTENDANCE_STATUS_CHOICES)
    notes = serializers.CharField(required=False, allow_blank=True)


class AttendanceBulkCreateSerializer(serializers.Serializer):
    date = serializers.DateField(default=date.today)
    records = serializers.ListField(child=AttendanceCreateSerializer())
    student_class = serializers.IntegerField(required=False)
    batch_id = serializers.IntegerField(required=False, allow_null=True)


class AttendanceSessionSerializer(serializers.ModelSerializer):
    batch = BatchSerializer(read_only=True)
    batch_id = serializers.PrimaryKeyRelatedField(
        queryset=Batch.objects.filter(is_active=True),
        source='batch',
        write_only=True,
        required=False,
        allow_null=True
    )
    taken_by_name = serializers.CharField(source='taken_by.get_full_name', read_only=True)
    student_class_display = serializers.CharField(source='get_student_class_display', read_only=True)

    class Meta:
        model = AttendanceSession
        fields = ['id', 'student_class', 'student_class_display', 'batch', 'batch_id', 'date', 'taken_by', 'taken_by_name', 'created_at', 'is_completed']
        read_only_fields = ['id', 'taken_by', 'taken_by_name', 'created_at']


class AttendanceCalendarSerializer(serializers.Serializer):
    """For student attendance calendar view"""
    date = serializers.DateField()
    status = serializers.ChoiceField(choices=settings.ATTENDANCE_STATUS_CHOICES)
    status_display = serializers.CharField()


class AttendanceStatsSerializer(serializers.Serializer):
    student = StudentListSerializer()
    total_days = serializers.IntegerField()
    present_count = serializers.IntegerField()
    absent_count = serializers.IntegerField()
    late_count = serializers.IntegerField()
    excused_count = serializers.IntegerField()
    attendance_rate = serializers.DecimalField(max_digits=5, decimal_places=2)