from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0045_fix_invoiced_ticket_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="servicereport",
            name="pdf_url",
            field=models.URLField(blank=True, default="", max_length=2000),
        ),
    ]
