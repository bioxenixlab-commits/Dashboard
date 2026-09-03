import os
import uuid

from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from apps.batches.models import Batch
from apps.students.models import Student
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()

ALLOWED_ATTACHMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'txt']
MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024  # 10 MB


def validate_attachment_size(value):
    if value and value.size > MAX_ATTACHMENT_SIZE:
        raise ValidationError(f'File size must be ≤ 10 MB (got {value.size // 1024 // 1024} MB).')


def homework_attachment_path(instance, filename):
    # Safe randomized filename to prevent path traversal and collisions
    ext = os.path.splitext(filename)[1].lower().lstrip('.')
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        ext = 'bin'
    new_name = f"{uuid.uuid4().hex}.{ext}"
    return f"homework_submissions/{new_name}"


class Homework(models.Model):
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    student_class = models.IntegerField(choices=settings.CLASS_CHOICES)
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True, related_name='homework')
    assigned_date = models.DateField(default=timezone.now)
    due_date = models.DateField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='normal')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_homework')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-assigned_date']
        db_table = 'homework_homework'

    def __str__(self):
        batch_info = f" ({self.batch.display_name})" if self.batch else ""
        return f"{self.title} (Class {self.student_class}{batch_info}) - Due: {self.due_date}"

    def get_target_students(self):
        queryset = Student.objects.filter(student_class=self.student_class, is_active=True)
        if self.batch:
            queryset = queryset.filter(batch=self.batch)
        return queryset


class HomeworkSubmission(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('submitted', 'Submitted'),
        ('late', 'Late'),
        ('graded', 'Graded'),
    ]

    homework = models.ForeignKey(Homework, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='homework_submissions')
    content = models.TextField(blank=True)
    attachment = models.FileField(upload_to=homework_attachment_path, null=True, blank=True, validators=[FileExtensionValidator(allowed_extensions=ALLOWED_ATTACHMENT_EXTENSIONS), validate_attachment_size])
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    submitted_at = models.DateTimeField(null=True, blank=True)
    graded_at = models.DateTimeField(null=True, blank=True)
    marks = models.IntegerField(null=True, blank=True)
    feedback = models.TextField(blank=True)
    graded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='graded_submissions')

    class Meta:
        unique_together = ['homework', 'student']
        ordering = ['-submitted_at']
        db_table = 'homework_homeworksubmission'

    def __str__(self):
        return f"{self.student.name} - {self.homework.title}: {self.get_status_display()}"