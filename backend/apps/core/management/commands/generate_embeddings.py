from django.core.management.base import BaseCommand
from apps.core.models import KnowledgeEntry, Ticket, TicketStatus
from apps.core.services.embeddings import embed_ticket, embed_knowledge_entry


class Command(BaseCommand):
    help = "Generate vector embeddings for all closed tickets and knowledge entries that are missing them."

    def add_arguments(self, parser):
        parser.add_argument("--tickets-only", action="store_true")
        parser.add_argument("--knowledge-only", action="store_true")

    def handle(self, *args, **options):
        do_tickets   = not options["knowledge_only"]
        do_knowledge = not options["tickets_only"]

        if do_tickets:
            qs = Ticket.objects.filter(
                status=TicketStatus.CLOSED, embedding__isnull=True
            ).prefetch_related("service_reports__parts_used__part", "asset__equipment_model")
            total = qs.count()
            self.stdout.write(f"Generating embeddings for {total} closed tickets...")
            ok = fail = 0
            for ticket in qs.iterator():
                if embed_ticket(ticket):
                    ok += 1
                else:
                    fail += 1
            self.stdout.write(self.style.SUCCESS(f"  Tickets: {ok} ok, {fail} skipped/failed"))

        if do_knowledge:
            qs = KnowledgeEntry.objects.filter(embedding__isnull=True)
            total = qs.count()
            self.stdout.write(f"Generating embeddings for {total} knowledge entries...")
            ok = fail = 0
            for entry in qs.iterator():
                if embed_knowledge_entry(entry):
                    ok += 1
                else:
                    fail += 1
            self.stdout.write(self.style.SUCCESS(f"  Knowledge: {ok} ok, {fail} skipped/failed"))

        self.stdout.write(self.style.SUCCESS("Done."))
