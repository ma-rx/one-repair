import os
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from apps.core.models import UserProfile, UserRole


class Command(BaseCommand):
    help = "Create initial ORS Admin user from environment variables"

    def handle(self, *args, **kwargs):
        email    = os.environ.get("DJANGO_SUPERUSER_EMAIL", "")
        username = os.environ.get("DJANGO_SUPERUSER_USERNAME", email)
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "")

        if not email or not password:
            self.stdout.write("Skipping: DJANGO_SUPERUSER_EMAIL or PASSWORD not set.")
            return

        if User.objects.filter(email__iexact=email).exists():
            self.stdout.write(f"User {email} already exists, skipping.")
            return

        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )
        UserProfile.objects.create(user=user, role=UserRole.ORS_ADMIN)
        self.stdout.write(self.style.SUCCESS(f"Created ORS Admin: {email}"))
