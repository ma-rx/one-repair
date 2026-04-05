from django.db import migrations


def fix_invoiced_ticket_status(apps, schema_editor):
    """
    Tickets that were invoiced before the COMPLETED status fix were incorrectly
    set to CLOSED. Update them to COMPLETED so they display as Payment Pending.
    Only touches CLOSED tickets that have a sent invoice and aren't PAID.
    """
    Ticket = apps.get_model("core", "Ticket")
    Ticket.objects.filter(
        status="CLOSED",
        service_reports__invoice_sent=True,
    ).exclude(
        status="PAID",
    ).update(status="COMPLETED")


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0044_servicereport_trip_charge"),
    ]

    operations = [
        migrations.RunPython(fix_invoiced_ticket_status, migrations.RunPython.noop),
    ]
