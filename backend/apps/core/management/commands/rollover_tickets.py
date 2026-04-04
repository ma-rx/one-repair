from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.core.models import Ticket, TicketStatus

TERMINAL_STATUSES = {
    TicketStatus.COMPLETED,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
    TicketStatus.CANCELLED,
}


class Command(BaseCommand):
    help = "Roll over any incomplete scheduled tickets to the next day."

    def handle(self, *args, **options):
        today = date.today()
        next_day = today + timedelta(days=1)

        tickets = Ticket.objects.filter(
            scheduled_date__lt=today,
            assigned_tech__isnull=False,
        ).exclude(status__in=TERMINAL_STATUSES)

        count = tickets.count()
        if count == 0:
            self.stdout.write("No incomplete tickets to roll over.")
            return

        tickets.update(scheduled_date=next_day)
        self.stdout.write(
            self.style.SUCCESS(
                f"Rolled over {count} ticket(s) to {next_day}."
            )
        )
