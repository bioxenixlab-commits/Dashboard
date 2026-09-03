from rest_framework import serializers
from django.utils import timezone
from .models import Payment
from apps.students.serializers import StudentListSerializer
from django.conf import settings


class PaymentSerializer(serializers.ModelSerializer):
    student = StudentListSerializer(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=Payment.objects.none(),
        source='student',
        write_only=True
    )
    month_name = serializers.CharField(read_only=True)

    class Meta:
        model = Payment
        fields = ['id', 'student', 'student_id', 'year', 'month', 'month_name', 'amount', 'is_paid', 'paid_date', 'notes', 'date_created']
        read_only_fields = ['id', 'date_created', 'paid_date', 'month_name']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'student_id' in self.fields:
            from apps.students.models import Student
            self.fields['student_id'].queryset = Student.objects.filter(is_active=True)


class PaymentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['is_paid', 'amount', 'notes']

    def update(self, instance, validated_data):
        is_paid = validated_data.get('is_paid', instance.is_paid)
        if is_paid and not instance.is_paid:
            instance.paid_date = timezone.now()
        elif not is_paid and instance.is_paid:
            instance.paid_date = None
        return super().update(instance, validated_data)


class PaymentStudentDetailSerializer(serializers.Serializer):
    student = StudentListSerializer()
    payments = PaymentSerializer(many=True)


class PaymentBulkUpdateSerializer(serializers.Serializer):
    payment_ids = serializers.ListField(child=serializers.IntegerField(), max_length=100, allow_empty=False)
    is_paid = serializers.BooleanField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_payment_ids(self, value):
        if len(value) > 100:
            raise serializers.ValidationError("Too many payment IDs (max 100).")
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Duplicate payment IDs not allowed.")
        return value


class PaymentUnpaidStudentsSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    student_code = serializers.CharField()
    name = serializers.CharField()
    phone = serializers.CharField()
    unpaid_months = serializers.ListField(child=serializers.DictField())
    unpaid_count = serializers.IntegerField()