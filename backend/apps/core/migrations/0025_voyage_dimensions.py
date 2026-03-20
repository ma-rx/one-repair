from django.db import migrations
import pgvector.django


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0024_add_embeddings"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            UPDATE core_ticket SET embedding = NULL WHERE embedding IS NOT NULL;
            UPDATE core_knowledgeentry SET embedding = NULL WHERE embedding IS NOT NULL;
            ALTER TABLE core_ticket ALTER COLUMN embedding TYPE vector(1024);
            ALTER TABLE core_knowledgeentry ALTER COLUMN embedding TYPE vector(1024);
            """,
            reverse_sql="""
            UPDATE core_ticket SET embedding = NULL WHERE embedding IS NOT NULL;
            UPDATE core_knowledgeentry SET embedding = NULL WHERE embedding IS NOT NULL;
            ALTER TABLE core_ticket ALTER COLUMN embedding TYPE vector(1536);
            ALTER TABLE core_knowledgeentry ALTER COLUMN embedding TYPE vector(1536);
            """,
            state_operations=[
                migrations.AlterField(
                    model_name="ticket",
                    name="embedding",
                    field=pgvector.django.VectorField(blank=True, dimensions=1024, null=True),
                ),
                migrations.AlterField(
                    model_name="knowledgeentry",
                    name="embedding",
                    field=pgvector.django.VectorField(blank=True, dimensions=1024, null=True),
                ),
            ],
        ),
    ]
