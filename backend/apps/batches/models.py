from django.db import models
from django.conf import settings


class Batch(models.Model):
    name = models.CharField(max_length=100)
    student_class = models.IntegerField(choices=settings.CLASS_CHOICES)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['student_class', 'name']
        unique_together = ['student_class', 'name']
        db_table = 'batches_batch'

    def __str__(self):
        return f"{self.get_student_class_display()} - {self.name}"

    @property
    def display_name(self):
        return f"{self.get_student_class_display()} - {self.name}"

    @property
    def student_count(self):
        return self.students.filter(is_active=True).count()