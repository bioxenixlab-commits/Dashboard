import secrets
import string

from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone
from django.conf import settings
from apps.batches.models import Batch


class Student(models.Model):
    CLASS_CHOICES = settings.CLASS_CHOICES

    student_id = models.CharField(max_length=20, unique=True, editable=False)
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    student_class = models.IntegerField(choices=CLASS_CHOICES)
    roll = models.IntegerField()
    ssc_session = models.IntegerField(help_text="Year when student will be in Class 10+1 (e.g., 27 for 2027)")
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    payment_start_month = models.IntegerField(default=1, help_text="Month to start collecting fees (1-12)")
    payment_start_year = models.IntegerField(default=timezone.now().year, help_text="Year to start collecting fees")
    password = models.CharField(max_length=128, help_text="Hashed with Django's password hasher; use set_student_password()")
    address = models.TextField(blank=True)
    parent_name = models.CharField(max_length=100, blank=True)
    parent_phone = models.CharField(max_length=15, blank=True)
    date_added = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['student_class', 'roll']
        unique_together = ['student_class', 'roll']
        db_table = 'students_student'

    def __str__(self):
        batch_info = f" ({self.batch.display_name})" if self.batch else ""
        return f"{self.student_id} - {self.name}{batch_info}"

    def set_student_password(self, raw_password: str):
        """Hash and store the student password securely."""
        self.password = make_password(raw_password)

    def check_student_password(self, raw_password: str) -> bool:
        """Verify a raw password against the stored hash. Handles legacy plaintext fallback."""
        if not self.password:
            return False
        # Legacy plaintext fallback: if stored value is not a hash, do direct compare then migrate on success
        if not self.password.startswith('pbkdf2_sha256$'):
            # Check if hash detection for other algorithms (argon2, etc.) - generic check for $ pattern
            if self.password.count('$') < 3:
                return self.password == raw_password
        return check_password(raw_password, self.password)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if not self.student_id:
            self.student_id = self.generate_student_id()
        if not self.password:
            raw = self.generate_password()
            self.password = make_password(raw)
            # Note: raw is not returned here; creation via API should use set_student_password in view to return raw
        else:
            # Defensive: if password looks like plaintext (not a hash), hash it before saving
            if self.password and not self.password.startswith('pbkdf2_sha256$') and self.password.count('$') < 3:
                # Heuristic: hashed passwords contain $ and start with algorithm name; plaintext is short alphanumeric
                # Only auto-hash if it doesn't look like a hash
                raw_plain = self.password
                self.password = make_password(raw_plain)
        super().save(*args, **kwargs)
        if is_new:
            self.create_payment_records()

    def create_payment_records(self):
        from apps.payments.models import Payment
        from datetime import datetime
        start_year = self.payment_start_year
        start_month = self.payment_start_month
        
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        for year in range(start_year, current_year + 1):
            month_start = start_month if year == start_year else 1
            month_end = current_month if year == current_year else 12
            
            for month_num in range(month_start, month_end + 1):
                Payment.objects.get_or_create(
                    student=self,
                    year=year,
                    month=month_num,
                    defaults={'amount': 1000, 'is_paid': False}
                )

    def generate_student_id(self):
        last_student = Student.objects.filter(
            ssc_session=self.ssc_session
        ).order_by('-student_id').first()

        if last_student and last_student.student_id:
            try:
                last_serial = int(last_student.student_id[-3:])
                new_serial = last_serial + 1
            except ValueError:
                new_serial = 1
        else:
            new_serial = 1

        return f"{self.ssc_session}{new_serial:03d}"

    def generate_password(self):
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(12))

    @property
    def unpaid_months_count(self):
        from apps.payments.models import Payment
        from datetime import datetime
        current_year = datetime.now().year
        current_month = datetime.now().month
        return Payment.objects.filter(
            student=self,
            year=current_year,
            month__lte=current_month,
            is_paid=False
        ).count()

    @property
    def overall_percentage(self):
        from apps.exams.models import ExamResult
        results = ExamResult.objects.filter(student=self, is_absent=False)
        if not results.exists():
            return 0
        return round(sum(r.percentage for r in results) / results.count(), 2)