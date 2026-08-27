from django.db import models
from apps.students.models import Student
from apps.batches.models import Batch
from django.utils import timezone
from django.conf import settings


class Exam(models.Model):
    CLASS_CHOICES = settings.CLASS_CHOICES

    name = models.CharField(max_length=200)
    exam_class = models.IntegerField(choices=CLASS_CHOICES)
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True, related_name='exams')
    total_marks = models.IntegerField(default=100)
    description = models.TextField(blank=True)
    date_created = models.DateTimeField(default=timezone.now)
    exam_date = models.DateField()
    is_published = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date_created']
        db_table = 'exams_exam'

    def __str__(self):
        batch_info = f" ({self.batch.display_name})" if self.batch else ""
        return f"{self.name} (Class {self.exam_class}{batch_info})"

    @property
    def student_count(self):
        queryset = Student.objects.filter(student_class=self.exam_class, is_active=True)
        if self.batch:
            queryset = queryset.filter(batch=self.batch)
        return queryset.count()

    @property
    def results_entered_count(self):
        return self.results.count()

    @property
    def is_upcoming(self):
        from datetime import date
        return self.exam_date >= date.today()


class ExamResult(models.Model):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='results')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='exam_results')
    marks_obtained = models.IntegerField(null=True, blank=True)
    is_absent = models.BooleanField(default=False)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    date_recorded = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ['exam', 'student']
        ordering = ['student__student_class', 'student__roll']
        db_table = 'exams_examresult'

    def __str__(self):
        status = "Absent" if self.is_absent else f"{self.marks_obtained}/{self.exam.total_marks}"
        return f"{self.student.name} - {self.exam.name}: {status}"

    def save(self, *args, **kwargs):
        if not self.is_absent and self.marks_obtained is not None:
            self.percentage = round((self.marks_obtained / self.exam.total_marks) * 100, 2)
        else:
            self.percentage = None
        super().save(*args, **kwargs)