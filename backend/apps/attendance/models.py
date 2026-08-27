from django.db import models
from apps.students.models import Student
from apps.batches.models import Batch
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class Attendance(models.Model):
    STATUS_CHOICES = settings.ATTENDANCE_STATUS_CHOICES

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='present')
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='recorded_attendance')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['student', 'date']
        ordering = ['-date', 'student__student_class', 'student__roll']
        db_table = 'attendance_attendance'
        indexes = [
            models.Index(fields=['date', 'student']),
            models.Index(fields=['student', 'date']),
        ]

    def __str__(self):
        return f"{self.student.name} - {self.date}: {self.get_status_display()}"

    @property
    def is_today(self):
        from datetime import date
        return self.date == date.today()


class AttendanceSession(models.Model):
    """Track attendance-taking sessions for audit trail"""
    student_class = models.IntegerField(choices=settings.CLASS_CHOICES)
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True, related_name='attendance_sessions')
    date = models.DateField()
    taken_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='attendance_sessions')
    created_at = models.DateTimeField(default=timezone.now)
    is_completed = models.BooleanField(default=False)

    class Meta:
        unique_together = ['student_class', 'batch', 'date']
        ordering = ['-date']
        db_table = 'attendance_attendancesession'

    def __str__(self):
        batch_info = f" ({self.batch.display_name})" if self.batch else ""
        return f"Attendance - Class {self.student_class}{batch_info} - {self.date}"