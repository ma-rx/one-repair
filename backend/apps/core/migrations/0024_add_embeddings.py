from django.db import migrations
import pgvector.django


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0023_invoice_workflow"),
    ]

    operations = [
        migrations.RunSQL(
            "CREATE EXTENSION IF NOT EXISTS vector;",
            reverse_sql="SELECT 1;",
        ),
        migrations.AddField(
            model_name="ticket",
            name="embedding",
            field=pgvector.django.VectorField(blank=True, dimensions=1536, null=True),
        ),
        migrations.AddField(
            model_name="knowledgeentry",
            name="embedding",
            field=pgvector.django.VectorField(blank=True, dimensions=1536, null=True),
        ),
    ]
