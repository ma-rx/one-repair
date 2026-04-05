from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0042_invoice_config"),
    ]

    operations = [
        migrations.AddField(
            model_name="servicereport",
            name="extra_line_items",
            field=models.JSONField(default=list),
        ),
    ]
