from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0029_servicereport_manager_on_site"),
    ]

    operations = [
        migrations.AddField(
            model_name="servicereport",
            name="manager_signature",
            field=models.TextField(blank=True, default=""),
        ),
    ]
