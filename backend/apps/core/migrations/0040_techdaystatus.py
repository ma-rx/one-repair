import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0039_repairimage'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TechDayStatus',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('date', models.DateField()),
                ('checked_in_at', models.DateTimeField(blank=True, null=True)),
                ('checked_out_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('tech', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='day_statuses',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-date'],
                'unique_together': {('tech', 'date')},
            },
        ),
    ]
