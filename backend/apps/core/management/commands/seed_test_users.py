from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from apps.core.models import Organization, Store, UserProfile, UserRole


class Command(BaseCommand):
    help = "Create test users for each role (dev/demo use only)"

    def handle(self, *args, **kwargs):
        # Test org + store
        org, _ = Organization.objects.get_or_create(
            name="Test Restaurant Group",
            defaults={"email": "contact@testgroup.com", "phone": "555-0100"},
        )
        store, _ = Store.objects.get_or_create(
            name="Test Location - Downtown",
            organization=org,
            defaults={"city": "New York", "state": "NY"},
        )

        users = [
            {
                "email": "client_admin@test.com",
                "first_name": "Alice",
                "last_name": "Admin",
                "role": UserRole.CLIENT_ADMIN,
                "organization": org,
                "store": None,
            },
            {
                "email": "manager@test.com",
                "first_name": "Bob",
                "last_name": "Manager",
                "role": UserRole.CLIENT_MANAGER,
                "organization": org,
                "store": store,
            },
            {
                "email": "tech@test.com",
                "first_name": "Carlos",
                "last_name": "Tech",
                "role": UserRole.TECH,
                "organization": None,
                "store": None,
            },
        ]

        for u in users:
            if User.objects.filter(email=u["email"]).exists():
                self.stdout.write(f"Already exists, skipping: {u['email']}")
                continue
            user = User.objects.create_user(
                username=u["email"],
                email=u["email"],
                password="testpass123",
                first_name=u["first_name"],
                last_name=u["last_name"],
            )
            UserProfile.objects.create(
                user=user,
                role=u["role"],
                organization=u["organization"],
                store=u["store"],
            )
            self.stdout.write(self.style.SUCCESS(f"Created {u['role']}: {u['email']}"))
