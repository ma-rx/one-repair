from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0026_add_db_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="ticket",
            name="route_order",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
