from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0040_noop'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='ticket',
            name='status',
            field=models.CharField(
                choices=[
                    ('OPEN', 'Open'),
                    ('DISPATCHED', 'Dispatched'),
                    ('IN_PROGRESS', 'In Progress'),
                    ('PENDING_PARTS', 'Pending Parts'),
                    ('COMPLETED', 'Completed'),
                    ('RESOLVED', 'Resolved'),
                    ('CLOSED', 'Closed'),
                    ('PAID', 'Paid'),
                    ('CANCELLED', 'Cancelled'),
                ],
                db_index=True,
                default='OPEN',
                max_length=50,
            ),
        ),
    ]
