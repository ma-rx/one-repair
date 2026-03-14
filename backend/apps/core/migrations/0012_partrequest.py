import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("core", "0011_ticketasset")]
    operations = [
        migrations.CreateModel(
            name="PartRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("part_name", models.CharField(blank=True, max_length=255)),
                ("sku", models.CharField(blank=True, max_length=100)),
                ("asset_category", models.CharField(blank=True, max_length=50, choices=[
                    ("HVAC", "HVAC"),
                    ("REFRIGERATION", "Refrigeration"),
                    ("COOKING_EQUIPMENT", "Cooking Equipment"),
                    ("ICE_MACHINE", "Ice Machine"),
                    ("DISHWASHER", "Dishwasher"),
                    ("POS_SYSTEM", "POS System"),
                    ("LIGHTING", "Lighting"),
                    ("PLUMBING", "Plumbing"),
                    ("ELECTRICAL", "Electrical"),
                    ("ELEVATOR", "Elevator"),
                    ("COFFEE_EQUIPMENT", "Coffee Equipment"),
                    ("ESPRESSO_MACHINE", "Espresso Machine"),
                    ("OTHER", "Other"),
                ])),
                ("make", models.CharField(blank=True, max_length=255)),
                ("model_number", models.CharField(blank=True, max_length=255)),
                ("vendor", models.CharField(blank=True, max_length=255)),
                ("cost_price", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("selling_price", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("quantity_needed", models.PositiveIntegerField(default=1)),
                ("urgency", models.CharField(max_length=20, choices=[
                    ("ASAP", "ASAP"),
                    ("NEXT_VISIT", "Next Visit"),
                ], default="NEXT_VISIT")),
                ("notes", models.TextField(blank=True)),
                ("status", models.CharField(max_length=30, choices=[
                    ("PENDING", "Pending ORS Review"),
                    ("APPROVED_ORS", "Approved by ORS"),
                    ("SENT_TO_CLIENT", "Sent to Client"),
                    ("APPROVED_CLIENT", "Approved by Client"),
                    ("DENIED", "Denied"),
                    ("ORDERED", "Ordered"),
                    ("DELIVERED", "Delivered"),
                ], default="PENDING")),
                ("tracking_number", models.CharField(blank=True, max_length=200)),
                ("approved_by_ors_at", models.DateTimeField(blank=True, null=True)),
                ("approved_by_client_at", models.DateTimeField(blank=True, null=True)),
                ("ordered_at", models.DateTimeField(blank=True, null=True)),
                ("delivered_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("part", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="requests",
                    to="core.part",
                )),
                ("ticket", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="part_requests",
                    to="core.ticket",
                )),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
