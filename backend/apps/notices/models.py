from django.db import models
from apps.batches.models import Batch
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class Notice(models.Model):
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    title = models.CharField(max_length=200)
    content = models.TextField()
    student_class = models.IntegerField(choices=settings.CLASS_CHOICES, null=True, blank=True, help_text="Null = All Classes")
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True, related_name='notices')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='normal')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_notices')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        db_table = 'notices_notice'

    def __str__(self):
        if self.student_class is None:
            class_info = "All Classes"
        else:
            class_info = f"Class {self.student_class}"
        batch_info = f" ({self.batch.display_name})" if self.batch else ""
        return f"{self.title} ({class_info}{batch_info})"

    @property
    def is_expired(self):
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False

    def get_target_students(self):
        from apps.students.models import Student
        if self.student_class is None:
            queryset = Student.objects.filter(is_active=True)
        else:
            queryset = Student.objects.filter(student_class=self.student_class, is_active=True)
        if self.batch:
            queryset = queryset.filter(batch=self.batch)
        return queryset