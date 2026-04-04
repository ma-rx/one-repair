from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.core.models import Ticket, TicketStatus

TERMINAL_STATUSES = {
    TicketStatus.COMPLETED,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
    TicketStatus.CANCELLED,
}


def next_business_day(from_date: date) -> date:
    """Return the next Monday-Friday after from_date."""
    d = from_date + timedelta(days=1)
    while d.weekday() >= 5:  # 5 = Sat, 6 = Sun
        d += timedelta(days=1)
    return d


class Command(BaseCommand):
    help = "Roll over any incomplete scheduled tickets to the next business day."

    def handle(self, *args, **options):
        today = date.today()
        next_day = next_business_day(today)

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
