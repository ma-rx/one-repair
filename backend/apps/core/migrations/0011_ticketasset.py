import uuid
from django.db import migrations, models
import django.db.models.deletion


def migrate_ticket_assets(apps, schema_editor):
    Ticket = apps.get_model("core", "Ticket")
    TicketAsset = apps.get_model("core", "TicketAsset")
    import uuid as _uuid
    for ticket in Ticket.objects.filter(
        models.Q(asset__isnull=False) | ~models.Q(asset_description="")
    ):
        TicketAsset.objects.create(
            id=_uuid.uuid4(),
            ticket_id=ticket.id,
            asset_id=ticket.asset_id,
            asset_description=ticket.asset_description or "",
        )


class Migration(migrations.Migration):
    dependencies = [("core", "0010_part_selling_price_vendor")]
    operations = [
        migrations.CreateModel(
            name="TicketAsset",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("asset_description", models.CharField(blank=True, default="", max_length=200)),
                ("symptom_code", models.CharField(blank=True, choices=[
                    ("NO_POWER", "No Power"),
                    ("WONT_START", "Won't Start"),
                    ("OVERHEATING", "Overheating"),
                    ("UNUSUAL_NOISE", "Unusual Noise"),
                    ("LEAKING", "Leaking"),
                    ("NOT_COOLING", "Not Cooling"),
                    ("NOT_HEATING", "Not Heating"),
                    ("DISPLAY_ISSUE", "Display Issue"),
                    ("ERROR_CODE_DISPLAYED", "Error Code Displayed"),
                    ("CONNECTIVITY_ISSUE", "Connectivity Issue"),
                    ("PHYSICAL_DAMAGE", "Physical Damage"),
                    ("SLOW_PERFORMANCE", "Slow Performance"),
                    ("OTHER", "Other"),
                ], default="", max_length=50)),
                ("resolution_code", models.CharField(blank=True, choices=[
                    ("REPLACED_PART", "Replaced Part"),
                    ("REPAIRED_IN_FIELD", "Repaired in Field"),
                    ("ADJUSTED_SETTINGS", "Adjusted Settings"),
                    ("FIRMWARE_UPDATE", "Firmware Update"),
                    ("CLEANED_SERVICED", "Cleaned / Serviced"),
                    ("REPROGRAMMED", "Reprogrammed"),
                    ("PREVENTIVE_MAINTENANCE", "Preventive Maintenance"),
                    ("AWAITING_PARTS", "Awaiting Parts"),
                    ("REFERRED_TO_VENDOR", "Referred to Vendor"),
                    ("NO_FAULT_FOUND", "No Fault Found"),
                    ("OTHER", "Other"),
                ], default="", max_length=50)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("asset", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to="core.asset",
                )),
                ("ticket", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="ticket_assets",
                    to="core.ticket",
                )),
            ],
            options={"ordering": ["created_at"]},
        ),
        migrations.RunPython(migrate_ticket_assets, reverse_code=migrations.RunPython.noop),
    ]
