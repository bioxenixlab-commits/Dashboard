# Generated for secure password hashing migration (Group B)
# Converts existing plaintext student passwords to Django hashes

from django.db import migrations
from django.contrib.auth.hashers import make_password


def hash_plain_passwords(apps, schema_editor):
    Student = apps.get_model('students', 'Student')
    for student in Student.objects.all():
        pwd = student.password
        if not pwd:
            continue
        # Already hashed? Django hashes start with algorithm name like 'pbkdf2_sha256$'
        if pwd.startswith('pbkdf2_sha256$') or pwd.startswith('argon2') or pwd.count('$') >= 3:
            continue
        # Heuristic: hashed passwords are > 30 chars and contain '$'
        if len(pwd) > 30 and '$' in pwd:
            continue
        # Plaintext: hash it
        student.password = make_password(pwd)
        student.save(update_fields=['password'])


def noop_reverse(apps, schema_editor):
    # Cannot reverse hashing (one-way). Noop.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(hash_plain_passwords, reverse_code=noop_reverse),
    ]
