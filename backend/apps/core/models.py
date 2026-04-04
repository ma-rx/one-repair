import uuid
from django.contrib.auth.models import User
from django.db import models
from pgvector.django import VectorField


# ── Enums ─────────────────────────────────────────────────────────────────────

class OrgPlan(models.TextChoices):
    STARTER      = "STARTER",      "Starter"
    PROFESSIONAL = "PROFESSIONAL", "Professional"
    ENTERPRISE   = "ENTERPRISE",   "Enterprise"


class UserRole(models.TextChoices):
    ORS_ADMIN      = "ORS_ADMIN",      "ORS Admin"
    CLIENT_ADMIN   = "CLIENT_ADMIN",   "Client Admin"
    CLIENT_MANAGER = "CLIENT_MANAGER", "Client Manager"
    TECH           = "TECH",           "Technician"


class AssetCategory(models.TextChoices):
    ESPRESSO_MACHINE  = "ESPRESSO_MACHINE",  "Espresso Machine"
    COFFEE_EQUIPMENT  = "COFFEE_EQUIPMENT",  "Coffee Equipment"
    DAIRY             = "DAIRY",             "Dairy"
    OVEN              = "OVEN",              "Oven"
    BAKING_OVEN       = "BAKING_OVEN",       "Baking Oven"
    TOASTER           = "TOASTER",           "Toaster"
    REFRIGERATION     = "REFRIGERATION",     "Refrigeration"
    ICE_MACHINE       = "ICE_MACHINE",       "Ice Machine"
    HVAC              = "HVAC",              "HVAC"
    ELECTRICAL        = "ELECTRICAL",        "Electrical"
    POS_SYSTEM        = "POS_SYSTEM",        "POS System"
    LIGHTING          = "LIGHTING",          "Lighting"
    BUILDING          = "BUILDING",          "Building"
    SINKS             = "SINKS",             "Sinks"
    PLUMBING          = "PLUMBING",          "Plumbing"
    DISHWASHER        = "DISHWASHER",        "Dishwasher"
    DRIVE_THRU        = "DRIVE_THRU",        "Drive Thru Window"
    WATER_SYSTEM      = "WATER_SYSTEM",      "Water System"
    TAP_DRAFT         = "TAP_DRAFT",         "Tap / Draft System"
    HOT_FOOD_HOLDING  = "HOT_FOOD_HOLDING",  "Hot Food Holding"
    MISC              = "MISC",              "Misc."
    OTHER             = "OTHER",             "Other"


class AssetStatus(models.TextChoices):
    OPERATIONAL       = "OPERATIONAL",       "Operational"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE", "Under Maintenance"
    OUT_OF_SERVICE    = "OUT_OF_SERVICE",    "Out of Service"
    DECOMMISSIONED    = "DECOMMISSIONED",    "Decommissioned"


class TicketPriority(models.TextChoices):
    LOW      = "LOW",      "Low"
    MEDIUM   = "MEDIUM",   "Medium"
    HIGH     = "HIGH",     "High"
    CRITICAL = "CRITICAL", "Critical"


class TicketStatus(models.TextChoices):
    OPEN          = "OPEN",          "Open"
    DISPATCHED    = "DISPATCHED",    "Dispatched"
    IN_PROGRESS   = "IN_PROGRESS",   "In Progress"
    PENDING_PARTS = "PENDING_PARTS", "Pending Parts"
    COMPLETED     = "COMPLETED",     "Completed"
    RESOLVED      = "RESOLVED",      "Resolved"
    CLOSED        = "CLOSED",        "Closed"
    CANCELLED     = "CANCELLED",     "Cancelled"


class SymptomCode(models.TextChoices):
    NO_POWER                 = "NO_POWER",                 "No Power"
    WONT_START               = "WONT_START",               "Won't Start"
    OVERHEATING              = "OVERHEATING",              "Overheating"
    TEMPERATURE_INCONSISTENT = "TEMPERATURE_INCONSISTENT", "Temperature Inconsistent"
    UNUSUAL_NOISE            = "UNUSUAL_NOISE",            "Unusual Noise"
    LEAKING                  = "LEAKING",                  "Leaking"
    NOT_COOLING              = "NOT_COOLING",              "Not Cooling"
    NOT_HEATING              = "NOT_HEATING",              "Not Heating"
    NOT_DISPENSING           = "NOT_DISPENSING",           "Not Dispensing"
    ICE_BUILDUP              = "ICE_BUILDUP",              "Ice Buildup / Frost"
    COMPRESSOR_ISSUE         = "COMPRESSOR_ISSUE",         "Compressor Issue"
    FILTER_CLOG              = "FILTER_CLOG",              "Filter / Clog"
    PUMP_FAILURE             = "PUMP_FAILURE",             "Pump Failure"
    DOOR_SEAL_ISSUE          = "DOOR_SEAL_ISSUE",          "Door / Seal Issue"
    IGNITER_ISSUE            = "IGNITER_ISSUE",            "Igniter Issue"
    PILOT_LIGHT_OUT          = "PILOT_LIGHT_OUT",          "Pilot Light Out"
    DISPLAY_ISSUE            = "DISPLAY_ISSUE",            "Display Issue"
    ERROR_CODE_DISPLAYED     = "ERROR_CODE_DISPLAYED",     "Error Code Displayed"
    CONNECTIVITY_ISSUE       = "CONNECTIVITY_ISSUE",       "Connectivity Issue"
    PHYSICAL_DAMAGE          = "PHYSICAL_DAMAGE",          "Physical Damage"
    SLOW_PERFORMANCE         = "SLOW_PERFORMANCE",         "Slow Performance"
    CALIBRATION_NEEDED       = "CALIBRATION_NEEDED",       "Calibration Needed"
    OTHER                    = "OTHER",                    "Other"


class ResolutionCode(models.TextChoices):
    # Specific replacements (most useful for AI training)
    REPLACED_COMPRESSOR      = "REPLACED_COMPRESSOR",      "Replaced Compressor"
    REPLACED_THERMOSTAT      = "REPLACED_THERMOSTAT",      "Replaced Thermostat"
    REPLACED_PUMP            = "REPLACED_PUMP",            "Replaced Pump"
    REPLACED_HEATING_ELEMENT = "REPLACED_HEATING_ELEMENT", "Replaced Heating Element"
    REPLACED_IGNITER         = "REPLACED_IGNITER",         "Replaced Igniter"
    REPLACED_CONTROL_BOARD   = "REPLACED_CONTROL_BOARD",   "Replaced Control Board"
    REPLACED_SEAL_GASKET     = "REPLACED_SEAL_GASKET",     "Replaced Seal / Gasket"
    REPLACED_FILTER          = "REPLACED_FILTER",          "Replaced Filter"
    REPLACED_PART            = "REPLACED_PART",            "Replaced Part (Other)"
    # Service actions
    REPAIRED_IN_FIELD        = "REPAIRED_IN_FIELD",        "Repaired in Field"
    DESCALED_CLEANED         = "DESCALED_CLEANED",         "Descaled / Deep Cleaned"
    CLEANED_SERVICED         = "CLEANED_SERVICED",         "Cleaned / Serviced"
    ADJUSTED_SETTINGS        = "ADJUSTED_SETTINGS",        "Adjusted Settings"
    CALIBRATED               = "CALIBRATED",               "Calibrated"
    REPROGRAMMED             = "REPROGRAMMED",             "Reprogrammed"
    FIRMWARE_UPDATE          = "FIRMWARE_UPDATE",          "Firmware Update"
    PREVENTIVE_MAINTENANCE   = "PREVENTIVE_MAINTENANCE",   "Preventive Maintenance"
    TRAINED_STAFF            = "TRAINED_STAFF",            "Trained Staff / User Error"
    # Outcomes
    AWAITING_PARTS           = "AWAITING_PARTS",           "Awaiting Parts"
    REFERRED_TO_VENDOR       = "REFERRED_TO_VENDOR",       "Referred to Vendor"
    NO_FAULT_FOUND           = "NO_FAULT_FOUND",           "No Fault Found"
    OTHER                    = "OTHER",                    "Other"


class PartRequestUrgency(models.TextChoices):
    ASAP       = "ASAP",       "ASAP"
    NEXT_VISIT = "NEXT_VISIT", "Next Visit"


class PartRequestStatus(models.TextChoices):
    PENDING         = "PENDING",         "Pending ORS Review"
    APPROVED_ORS    = "APPROVED_ORS",    "Approved by ORS"
    SENT_TO_CLIENT  = "SENT_TO_CLIENT",  "Sent to Client"
    APPROVED_CLIENT = "APPROVED_CLIENT", "Approved by Client"
    DENIED          = "DENIED",          "Denied"
    ORDERED         = "ORDERED",         "Ordered"
    DELIVERED       = "DELIVERED",       "Delivered"


class PartCategory(models.TextChoices):
    MECHANICAL  = "MECHANICAL",  "Mechanical"
    ELECTRICAL  = "ELECTRICAL",  "Electrical"
    REFRIGERANT = "REFRIGERANT", "Refrigerant"
    CONSUMABLE  = "CONSUMABLE",  "Consumable"
    OTHER       = "OTHER",       "Other"


class KnowledgeDifficulty(models.TextChoices):
    EASY     = "EASY",     "Easy"
    MEDIUM   = "MEDIUM",   "Medium"
    HARD     = "HARD",     "Hard"
    ADVANCED = "ADVANCED", "Advanced"


# ── Models ─────────────────────────────────────────────────────────────────────

class SymptomCodeEntry(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code         = models.CharField(max_length=100)
    label        = models.CharField(max_length=255)
    make         = models.CharField(max_length=100, blank=True, default="")  # blank = global
    asset_category = models.CharField(max_length=30, choices=AssetCategory.choices, blank=True, default="")
    is_active    = models.BooleanField(default=True)
    sort_order   = models.PositiveIntegerField(default=0)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "label"]
        unique_together = [["code", "make"]]

    def __str__(self):
        return f"{self.label} ({self.make or 'Global'})"


class ResolutionCodeEntry(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code         = models.CharField(max_length=100)
    label        = models.CharField(max_length=255)
    make         = models.CharField(max_length=100, blank=True, default="")  # blank = global
    asset_category = models.CharField(max_length=30, choices=AssetCategory.choices, blank=True, default="")
    is_active    = models.BooleanField(default=True)
    sort_order   = models.PositiveIntegerField(default=0)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "label"]
        unique_together = [["code", "make"]]

    def __str__(self):
        return f"{self.label} ({self.make or 'Global'})"


class EquipmentModel(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    make         = models.CharField(max_length=100)
    model_number = models.CharField(max_length=100)
    model_name   = models.CharField(max_length=255, blank=True, default="")
    category     = models.CharField(max_length=30, choices=AssetCategory.choices)
    description  = models.TextField(blank=True, default="")
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["make", "model_number"]
        unique_together = [["make", "model_number"]]

    def __str__(self):
        return f"{self.make} {self.model_number}"


class PricingConfig(models.Model):
    """Singleton — one row stores global pricing rates."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip_charge = models.DecimalField(max_digits=8, decimal_places=2, default=95.00)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, default=125.00)
    min_hours   = models.DecimalField(max_digits=4, decimal_places=2, default=1.00)
    tax_rate    = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Pricing Config"
        verbose_name_plural = "Pricing Config"

    def __str__(self):
        return f"${self.trip_charge} trip + ${self.hourly_rate}/hr (min {self.min_hours}h, tax {self.tax_rate}%)"

class Organization(models.Model):
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name      = models.CharField(max_length=255)
    email     = models.EmailField(blank=True)
    phone     = models.CharField(max_length=50, blank=True)
    address   = models.CharField(max_length=500, blank=True)
    plan      = models.CharField(max_length=20, choices=OrgPlan.choices, default=OrgPlan.STARTER)
    is_active = models.BooleanField(default=True)
    code      = models.CharField(max_length=2, blank=True, default="", help_text="2-letter prefix for ticket numbers (e.g. DD, CB)")
    nte_limit = models.DecimalField(max_digits=10, decimal_places=2, default=500, help_text="Not-to-exceed limit for parts approval")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class TicketCounter(models.Model):
    organization = models.OneToOneField(
        Organization, null=True, blank=True, on_delete=models.CASCADE, related_name="ticket_counter"
    )
    last_number = models.PositiveIntegerField(default=0)
    class Meta:
        ordering = []


class UserProfile(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user         = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    organization = models.ForeignKey(
        Organization, null=True, blank=True,
        on_delete=models.CASCADE, related_name="members"
    )
    # Only set for CLIENT_MANAGER — ties them to a single store (iPad)
    store = models.ForeignKey(
        "Store", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="managers"
    )
    role      = models.CharField(max_length=20, choices=UserRole.choices)
    phone     = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.role})"


class DistrictManager(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="district_managers")
    name         = models.CharField(max_length=255)
    phone        = models.CharField(max_length=50, blank=True)
    email        = models.EmailField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.organization.name})"


class Store(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="stores")
    name         = models.CharField(max_length=255)
    address_line1 = models.CharField(max_length=255, blank=True)
    address_line2 = models.CharField(max_length=255, blank=True)
    city         = models.CharField(max_length=100, blank=True)
    state        = models.CharField(max_length=100, blank=True)
    zip_code     = models.CharField(max_length=20, blank=True)
    country      = models.CharField(max_length=100, default="US")
    phone        = models.CharField(max_length=50, blank=True)
    email        = models.EmailField(blank=True)
    hours        = models.TextField(blank=True, default="", help_text="Store operating hours (e.g. Mon-Fri 6am-9pm)")
    manager      = models.ForeignKey(
        User, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="managed_stores"
    )
    district_manager = models.ForeignKey(
        DistrictManager, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="stores"
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.organization.name} — {self.name}"


class Asset(models.Model):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store            = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="assets")
    equipment_model  = models.ForeignKey(
        EquipmentModel, null=True, blank=True, on_delete=models.SET_NULL, related_name="instances"
    )
    name             = models.CharField(max_length=255)
    category         = models.CharField(max_length=50, choices=AssetCategory.choices, default=AssetCategory.OTHER)
    make             = models.CharField(max_length=255, blank=True)
    model_number     = models.CharField(max_length=255, blank=True)
    serial_number    = models.CharField(max_length=255, blank=True)
    install_date     = models.DateField(null=True, blank=True)
    warranty_expiry  = models.DateField(null=True, blank=True)
    status           = models.CharField(max_length=50, choices=AssetStatus.choices, default=AssetStatus.OPERATIONAL, db_index=True)
    is_active        = models.BooleanField(default=True, db_index=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.store.name})"


class Part(models.Model):
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name                = models.CharField(max_length=255)
    sku                 = models.CharField(max_length=100, blank=True)
    asset_category      = models.CharField(max_length=50, choices=AssetCategory.choices, default=AssetCategory.OTHER)
    make                = models.CharField(max_length=255, blank=True)
    quantity_on_hand    = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=2)
    unit_price          = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    selling_price       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vendor              = models.CharField(max_length=255, blank=True)
    compatible_models   = models.ManyToManyField(EquipmentModel, blank=True, related_name="compatible_parts")
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} (qty: {self.quantity_on_hand})"

    @property
    def is_low_stock(self):
        return self.quantity_on_hand <= self.low_stock_threshold


class Ticket(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_number = models.CharField(max_length=20, blank=True, default="", db_index=True)
    asset         = models.ForeignKey(Asset, null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    store         = models.ForeignKey("Store", null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    asset_description = models.CharField(max_length=200, blank=True, default="")
    opened_by     = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="opened_tickets"
    )
    assigned_tech = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_tickets"
    )
    symptom_code   = models.CharField(max_length=50, choices=SymptomCode.choices, blank=True, default="")
    description    = models.TextField(blank=True, default="")
    priority       = models.CharField(max_length=20, choices=TicketPriority.choices, default=TicketPriority.MEDIUM)
    status         = models.CharField(max_length=50, choices=TicketStatus.choices, default=TicketStatus.OPEN, db_index=True)
    scheduled_date = models.DateField(null=True, blank=True)
    route_order    = models.PositiveIntegerField(null=True, blank=True)
    sla_due_at     = models.DateTimeField(null=True, blank=True)
    closed_at      = models.DateTimeField(null=True, blank=True)
    embedding      = VectorField(dimensions=1024, null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Ticket {self.ticket_number or self.id} — {self.symptom_code} ({self.status})"

    def assign_ticket_number(self):
        if self.ticket_number:
            return
        from django.db import transaction
        org = None
        if self.store_id:
            try:
                from .models import Store
                store = Store.objects.select_related("organization").get(pk=self.store_id)
                org = store.organization
            except Exception:
                pass
        if org is None and self.asset_id:
            try:
                from .models import Asset
                asset = Asset.objects.select_related("store__organization").get(pk=self.asset_id)
                if asset.store:
                    org = asset.store.organization
            except Exception:
                pass
        prefix = (org.code.upper() if org and org.code else "ORS")
        with transaction.atomic():
            counter, _ = TicketCounter.objects.select_for_update().get_or_create(organization=org)
            counter.last_number += 1
            counter.save(update_fields=["last_number"])
        self.ticket_number = f"{prefix}{counter.last_number:06d}"


class TicketAsset(models.Model):
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket            = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="ticket_assets")
    asset             = models.ForeignKey("Asset", null=True, blank=True, on_delete=models.SET_NULL)
    asset_description = models.CharField(max_length=200, blank=True, default="")
    symptom_code      = models.CharField(max_length=50, choices=SymptomCode.choices, blank=True, default="")
    resolution_code   = models.CharField(max_length=50, choices=ResolutionCode.choices, blank=True, default="")
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"TicketAsset {self.asset or self.asset_description} on {self.ticket_id}"


class TimeEntry(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tech           = models.ForeignKey(User, on_delete=models.CASCADE, related_name="time_entries")
    ticket         = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="time_entries")
    clocked_in_at  = models.DateTimeField()
    clocked_out_at = models.DateTimeField(null=True, blank=True)
    total_minutes  = models.PositiveIntegerField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-clocked_in_at"]

    def __str__(self):
        return f"{self.tech} on Ticket {self.ticket_id}"


class WorkImage(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket      = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="work_images")
    uploaded_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    url         = models.URLField(max_length=1000)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class ServiceReport(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket          = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="service_reports")
    submitted_by    = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="service_reports"
    )
    resolution_code  = models.CharField(max_length=50, choices=ResolutionCode.choices)
    labor_cost       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    invoice_sent     = models.BooleanField(default=False)
    invoice_email    = models.EmailField(blank=True)
    tech_notes       = models.TextField(blank=True)
    formatted_report = models.TextField(blank=True)
    manager_on_site      = models.CharField(max_length=255, blank=True, default="")
    manager_signature    = models.TextField(blank=True, default="")  # base64 PNG data URL
    draft_parts      = models.JSONField(default=list)   # [{"part_id": "uuid", "quantity": N}]
    tax_rate         = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"ServiceReport {self.id} — {self.resolution_code}"

    @property
    def parts_total(self):
        return sum(p.line_total for p in self.parts_used.all())

    @property
    def sales_tax(self):
        from decimal import Decimal
        return (self.labor_cost + self.parts_total) * self.tax_rate / Decimal("100")

    @property
    def grand_total(self):
        return self.labor_cost + self.parts_total + self.sales_tax


class PartUsed(models.Model):
    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_report     = models.ForeignKey(ServiceReport, on_delete=models.CASCADE, related_name="parts_used")
    part               = models.ForeignKey(Part, on_delete=models.PROTECT, related_name="usages")
    quantity           = models.PositiveIntegerField()
    unit_price_at_time = models.DecimalField(max_digits=10, decimal_places=2)
    created_at         = models.DateTimeField(auto_now_add=True)

    @property
    def line_total(self):
        return self.quantity * self.unit_price_at_time

    def __str__(self):
        return f"{self.quantity}x {self.part.name} on {self.service_report.id}"


class PartsApprovalStatus(models.TextChoices):
    PENDING        = "PENDING",        "Pending ORS Review"
    SENT_TO_CLIENT = "SENT_TO_CLIENT", "Sent to Client"
    APPROVED       = "APPROVED",       "Approved"
    DENIED         = "DENIED",         "Denied by Client"
    ORDERED        = "ORDERED",        "Ordered"
    DELIVERED      = "DELIVERED",      "Delivered"


class PartsApproval(models.Model):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket           = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="parts_approvals")
    status           = models.CharField(max_length=30, choices=PartsApprovalStatus.choices, default=PartsApprovalStatus.PENDING)
    notes_for_client = models.TextField(blank=True, default="")
    denied_reason    = models.TextField(blank=True, default="")
    tracking_number  = models.CharField(max_length=200, blank=True, default="")
    followup_ticket  = models.ForeignKey(
        Ticket, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="sourced_from_parts_approval"
    )
    created_by       = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_parts_approvals")
    sent_at          = models.DateTimeField(null=True, blank=True)
    approved_at      = models.DateTimeField(null=True, blank=True)
    denied_at        = models.DateTimeField(null=True, blank=True)
    ordered_at       = models.DateTimeField(null=True, blank=True)
    delivered_at     = models.DateTimeField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def total_selling_price(self):
        from decimal import Decimal
        return sum(
            (pr.selling_price or Decimal("0")) * pr.quantity_needed
            for pr in self.part_requests.all()
        )

    @property
    def nte_limit(self):
        try:
            return self.ticket.store.organization.nte_limit
        except Exception:
            from decimal import Decimal
            return Decimal("500")

    @property
    def requires_client_approval(self):
        return self.total_selling_price > self.nte_limit

    def __str__(self):
        return f"PartsApproval {self.id} ({self.status})"


class PartRequest(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parts_approval = models.ForeignKey(
        "PartsApproval", null=True, blank=True, on_delete=models.SET_NULL, related_name="part_requests"
    )
    ticket         = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="part_requests")
    part           = models.ForeignKey(Part, null=True, blank=True, on_delete=models.SET_NULL, related_name="requests")
    part_name      = models.CharField(max_length=255, blank=True)
    sku            = models.CharField(max_length=100, blank=True)
    asset_category = models.CharField(max_length=50, choices=AssetCategory.choices, blank=True)
    make           = models.CharField(max_length=255, blank=True)
    model_number   = models.CharField(max_length=255, blank=True)
    vendor         = models.CharField(max_length=255, blank=True)
    cost_price     = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    selling_price  = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    quantity_needed = models.PositiveIntegerField(default=1)
    urgency         = models.CharField(max_length=20, choices=PartRequestUrgency.choices, default=PartRequestUrgency.NEXT_VISIT)
    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        name = self.part.name if self.part else self.part_name
        return f"PartRequest: {name} x{self.quantity_needed}"


class KnowledgeEntry(models.Model):
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    equipment_model     = models.ForeignKey(
        EquipmentModel, null=True, blank=True, on_delete=models.SET_NULL, related_name="knowledge_entries"
    )
    asset_category       = models.CharField(max_length=30, choices=AssetCategory.choices)
    make                 = models.CharField(max_length=100, blank=True, default="")
    model_number         = models.CharField(max_length=100, blank=True, default="")
    symptom_code         = models.CharField(max_length=50, choices=SymptomCode.choices, blank=True, default="")
    symptom_description  = models.TextField(blank=True, default="")
    diagnostic_steps     = models.JSONField(default=list, blank=True)
    difficulty           = models.CharField(max_length=10, choices=KnowledgeDifficulty.choices, default=KnowledgeDifficulty.MEDIUM)
    cause_summary        = models.TextField(blank=True, default="")
    parts_commonly_used  = models.TextField(blank=True, default="")
    pro_tips             = models.TextField(blank=True, default="")
    contributed_by       = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="knowledge_entries"
    )
    is_verified          = models.BooleanField(default=False)
    embedding            = VectorField(dimensions=1024, null=True, blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"KnowledgeEntry: {self.symptom_description or self.symptom_code or 'Entry'} ({self.asset_category})"
