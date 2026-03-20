from django.db import migrations
import pgvector.django


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0024_add_embeddings"),
    ]

    operations = [
        # Null out any existing 1536-dim embeddings before resizing
        migrations.RunSQL(
            """
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
        ),
    ]
