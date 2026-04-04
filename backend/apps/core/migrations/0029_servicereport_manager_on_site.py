from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0028_ticket_numbers_parts_approval"),
    ]

    operations = [
        migrations.AddField(
            model_name="servicereport",
            name="manager_on_site",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
