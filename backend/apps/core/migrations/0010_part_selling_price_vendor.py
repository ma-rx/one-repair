from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0009_add_ticket_scheduled_date")]
    operations = [
        migrations.AddField(
            model_name="part",
            name="selling_price",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="part",
            name="vendor",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
