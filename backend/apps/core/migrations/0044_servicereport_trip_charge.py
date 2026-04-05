from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0043_servicereport_extra_line_items"),
    ]

    operations = [
        migrations.AddField(
            model_name="servicereport",
            name="trip_charge",
            field=models.DecimalField(max_digits=10, decimal_places=2, default=0),
        ),
    ]
