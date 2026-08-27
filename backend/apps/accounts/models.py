from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ('teacher', 'Teacher'),
        ('student', 'Student'),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='teacher')
    student = models.OneToOneField('students.Student', on_delete=models.CASCADE, null=True, blank=True, related_name='user_account')

    def __str__(self):
        return f"{self.username} ({self.role})"

    class Meta:
        db_table = 'accounts_user'