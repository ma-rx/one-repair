from django.db import migrations, models
import django.db.models.deletion
import uuid
from decimal import Decimal


def delete_all_part_requests(apps, schema_editor):
    PartRequest = apps.get_model("core", "PartRequest")
    PartRequest.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0027_ticket_route_order"),
    ]

    operations = [
        # Organization fields
        migrations.AddField(
            model_name="organization",
            name="code",
            field=models.CharField(blank=True, default="", max_length=2),
        ),
        migrations.AddField(
            model_name="organization",
            name="nte_limit",
            field=models.DecimalField(decimal_places=2, default=500, max_digits=10),
        ),
        # TicketCounter
        migrations.CreateModel(
            name="TicketCounter",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("last_number", models.PositiveIntegerField(default=0)),
                ("organization", models.OneToOneField(
                    blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                    related_name="ticket_counter", to="core.organization"
                )),
            ],
        ),
        # Ticket number
        migrations.AddField(
            model_name="ticket",
            name="ticket_number",
            field=models.CharField(blank=True, db_index=True, default="", max_length=20),
        ),
        # PartsApproval model
        migrations.CreateModel(
            name="PartsApproval",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("status", models.CharField(
                    choices=[
                        ("PENDING", "Pending ORS Review"),
                        ("SENT_TO_CLIENT", "Sent to Client"),
                        ("APPROVED", "Approved"),
                        ("DENIED", "Denied by Client"),
                        ("ORDERED", "Ordered"),
                        ("DELIVERED", "Delivered"),
                    ],
                    default="PENDING", max_length=30,
                )),
                ("notes_for_client", models.TextField(blank=True, default="")),
                ("denied_reason", models.TextField(blank=True, default="")),
                ("tracking_number", models.CharField(blank=True, default="", max_length=200)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("denied_at", models.DateTimeField(blank=True, null=True)),
                ("ordered_at", models.DateTimeField(blank=True, null=True)),
                ("delivered_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("ticket", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="parts_approvals", to="core.ticket"
                )),
                ("created_by", models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name="created_parts_approvals", to="auth.user"
                )),
            ],
            options={"ordering": ["-created_at"]},
        ),
        # Delete existing PartRequests before schema change
        migrations.RunPython(delete_all_part_requests, migrations.RunPython.noop),
        # Add parts_approval FK to PartRequest
        migrations.AddField(
            model_name="partrequest",
            name="parts_approval",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="part_requests", to="core.partsapproval"
            ),
        ),
        # Remove old individual-status fields from PartRequest
        migrations.RemoveField(model_name="partrequest", name="status"),
        migrations.RemoveField(model_name="partrequest", name="tracking_number"),
        migrations.RemoveField(model_name="partrequest", name="approved_by_ors_at"),
        migrations.RemoveField(model_name="partrequest", name="approved_by_client_at"),
        migrations.RemoveField(model_name="partrequest", name="ordered_at"),
        migrations.RemoveField(model_name="partrequest", name="delivered_at"),
    ]
