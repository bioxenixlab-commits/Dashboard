from django.db import models
from apps.students.models import Student
from django.utils import timezone
from django.conf import settings


class Payment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='payments')
    year = models.IntegerField()
    month = models.IntegerField(choices=settings.MONTH_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=1000)
    is_paid = models.BooleanField(default=False)
    paid_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    date_created = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-year', '-month']
        unique_together = ['student', 'year', 'month']
        db_table = 'payments_payment'

    def __str__(self):
        return f"{self.student.name} - {self.get_month_display()} {self.year}"

    @property
    def month_name(self):
        return dict(settings.MONTH_CHOICES)[self.month]