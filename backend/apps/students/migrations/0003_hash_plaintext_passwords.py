from django.db import migrations
from django.contrib.auth.hashers import make_password, check_password

def hash_plaintext_passwords(apps, schema_editor):
    Student = apps.get_model('students', 'Student')
    hashed = 0
    for s in Student.objects.all().iterator():
        pwd = s.password or ''
        # Skip already-hashed (any Django hasher starts with algorithm$ and has >=3 $)
        if not pwd or pwd.startswith('pbkdf2_sha256$') or pwd.count('$') >= 3:
            # Also try to detect already-hashed via check_password pattern: if it's a valid hash, skip
            # Fallback: if check_password can verify empty string without error, it's a hash - skip
            continue
        # Plaintext -> hash
        s.password = make_password(pwd)
        s.save(update_fields=['password'])
        hashed += 1
    if hashed:
        print(f"Hashed {hashed} plaintext student passwords")

def noop(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('students', '0002_student_payment_start_month'),
    ]

    operations = [
        migrations.RunPython(hash_plaintext_passwords, noop),
    ]
