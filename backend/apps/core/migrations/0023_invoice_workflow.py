from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0022_symptom_resolution_code_entries"),
    ]

    operations = [
        migrations.AddField(
            model_name="pricingconfig",
            name="tax_rate",
            field=models.DecimalField(max_digits=5, decimal_places=2, default=0),
        ),
        migrations.AddField(
            model_name="servicereport",
            name="draft_parts",
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name="servicereport",
            name="tax_rate",
            field=models.DecimalField(max_digits=5, decimal_places=2, default=0),
        ),
        migrations.AlterField(
            model_name="ticket",
            name="status",
            field=models.CharField(
                max_length=50,
                choices=[
                    ("OPEN", "Open"),
                    ("DISPATCHED", "Dispatched"),
                    ("IN_PROGRESS", "In Progress"),
                    ("PENDING_PARTS", "Pending Parts"),
                    ("COMPLETED", "Completed"),
                    ("RESOLVED", "Resolved"),
                    ("CLOSED", "Closed"),
                    ("CANCELLED", "Cancelled"),
                ],
                default="OPEN",
            ),
        ),
    ]
