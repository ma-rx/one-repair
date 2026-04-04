from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0032_partsapproval_followup_ticket"),
    ]

    operations = [
        migrations.RemoveField(model_name="knowledgeentry", name="resolution_code"),
        migrations.RemoveField(model_name="knowledgeentry", name="procedure"),
        migrations.AlterField(
            model_name="knowledgeentry",
            name="symptom_code",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="knowledgeentry",
            name="symptom_description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="knowledgeentry",
            name="diagnostic_steps",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
