from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0041_ticket_paid_completedat'),
    ]

    operations = [
        # PricingConfig — company branding/contact
        migrations.AddField(model_name='pricingconfig', name='company_name',
            field=models.CharField(default='One Repair Solutions', max_length=255)),
        migrations.AddField(model_name='pricingconfig', name='company_address',
            field=models.CharField(blank=True, default='', max_length=500)),
        migrations.AddField(model_name='pricingconfig', name='company_phone',
            field=models.CharField(blank=True, default='', max_length=50)),
        migrations.AddField(model_name='pricingconfig', name='company_email',
            field=models.EmailField(blank=True, default='')),
        migrations.AddField(model_name='pricingconfig', name='logo_url',
            field=models.URLField(blank=True, default='', max_length=2000)),

        # Organization — invoice config
        migrations.AddField(model_name='organization', name='payment_terms',
            field=models.CharField(
                choices=[
                    ('DUE_ON_RECEIPT', 'Due on Receipt'),
                    ('NET_15', 'Net 15'),
                    ('NET_30', 'Net 30'),
                    ('NET_45', 'Net 45'),
                ],
                default='NET_30', max_length=20,
            )),
        migrations.AddField(model_name='organization', name='invoice_emails',
            field=models.JSONField(blank=True, default=list,
                help_text='List of email addresses to receive invoices')),

        # Store — per-store tax rate override
        migrations.AddField(model_name='store', name='tax_rate',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True,
                help_text='Store-level tax rate override. Overrides org/global default if set.')),

        # ServiceReport — Stripe payment tracking
        migrations.AddField(model_name='servicereport', name='stripe_session_id',
            field=models.CharField(blank=True, default='', max_length=255)),
        migrations.AddField(model_name='servicereport', name='stripe_payment_url',
            field=models.URLField(blank=True, default='', max_length=2000)),
    ]
