from rest_framework import serializers
from .models import Batch


class BatchSerializer(serializers.ModelSerializer):
    student_count = serializers.IntegerField(read_only=True)
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = Batch
        fields = ['id', 'name', 'student_class', 'description', 'is_active', 'display_name', 'student_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'student_count', 'display_name']


class BatchCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Batch
        fields = ['name', 'student_class', 'description', 'is_active']


class BatchStudentReassignSerializer(serializers.Serializer):
    target_batch = serializers.PrimaryKeyRelatedField(queryset=Batch.objects.filter(is_active=True), required=False, allow_null=True)
    new_batch_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    new_batch_description = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if not data.get('target_batch') and not data.get('new_batch_name'):
            raise serializers.ValidationError("Either target_batch or new_batch_name must be provided.")
        return data