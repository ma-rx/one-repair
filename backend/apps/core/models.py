import uuid
from django.contrib.auth.models import User
from django.db import models


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
    HVAC              = "HVAC",              "HVAC"
    REFRIGERATION     = "REFRIGERATION",     "Refrigeration"
    COOKING_EQUIPMENT = "COOKING_EQUIPMENT", "Cooking Equipment"
    ICE_MACHINE       = "ICE_MACHINE",       "Ice Machine"
    DISHWASHER        = "DISHWASHER",        "Dishwasher"
    POS_SYSTEM        = "POS_SYSTEM",        "POS System"
    LIGHTING          = "LIGHTING",          "Lighting"
    PLUMBING          = "PLUMBING",          "Plumbing"
    ELECTRICAL        = "ELECTRICAL",        "Electrical"
    ELEVATOR          = "ELEVATOR",          "Elevator"
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
    IN_PROGRESS   = "IN_PROGRESS",   "In Progress"
    PENDING_PARTS = "PENDING_PARTS", "Pending Parts"
    RESOLVED      = "RESOLVED",      "Resolved"
    CLOSED        = "CLOSED",        "Closed"
    CANCELLED     = "CANCELLED",     "Cancelled"


class SymptomCode(models.TextChoices):
    NO_POWER            = "NO_POWER",            "No Power"
    WONT_START          = "WONT_START",          "Won't Start"
    OVERHEATING         = "OVERHEATING",         "Overheating"
    UNUSUAL_NOISE       = "UNUSUAL_NOISE",        "Unusual Noise"
    LEAKING             = "LEAKING",             "Leaking"
    NOT_COOLING         = "NOT_COOLING",         "Not Cooling"
    NOT_HEATING         = "NOT_HEATING",         "Not Heating"
    DISPLAY_ISSUE       = "DISPLAY_ISSUE",       "Display Issue"
    ERROR_CODE_DISPLAYED = "ERROR_CODE_DISPLAYED", "Error Code Displayed"
    CONNECTIVITY_ISSUE  = "CONNECTIVITY_ISSUE",  "Connectivity Issue"
    PHYSICAL_DAMAGE     = "PHYSICAL_DAMAGE",     "Physical Damage"
    SLOW_PERFORMANCE    = "SLOW_PERFORMANCE",    "Slow Performance"
    OTHER               = "OTHER",               "Other"


class ResolutionCode(models.TextChoices):
    REPLACED_PART        = "REPLACED_PART",        "Replaced Part"
    REPAIRED_IN_FIELD    = "REPAIRED_IN_FIELD",    "Repaired in Field"
    ADJUSTED_SETTINGS    = "ADJUSTED_SETTINGS",    "Adjusted Settings"
    FIRMWARE_UPDATE      = "FIRMWARE_UPDATE",      "Firmware Update"
    CLEANED_SERVICED     = "CLEANED_SERVICED",     "Cleaned / Serviced"
    REPROGRAMMED         = "REPROGRAMMED",         "Reprogrammed"
    PREVENTIVE_MAINTENANCE = "PREVENTIVE_MAINTENANCE", "Preventive Maintenance"
    AWAITING_PARTS       = "AWAITING_PARTS",       "Awaiting Parts"
    REFERRED_TO_VENDOR   = "REFERRED_TO_VENDOR",   "Referred to Vendor"
    NO_FAULT_FOUND       = "NO_FAULT_FOUND",       "No Fault Found"
    OTHER                = "OTHER",                "Other"


class PartCategory(models.TextChoices):
    MECHANICAL  = "MECHANICAL",  "Mechanical"
    ELECTRICAL  = "ELECTRICAL",  "Electrical"
    REFRIGERANT = "REFRIGERANT", "Refrigerant"
    CONSUMABLE  = "CONSUMABLE",  "Consumable"
    OTHER       = "OTHER",       "Other"


# ── Models ─────────────────────────────────────────────────────────────────────

class Organization(models.Model):
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name      = models.CharField(max_length=255)
    email     = models.EmailField(blank=True)
    phone     = models.CharField(max_length=50, blank=True)
    address   = models.CharField(max_length=500, blank=True)
    plan      = models.CharField(max_length=20, choices=OrgPlan.choices, default=OrgPlan.STARTER)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


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
    manager      = models.ForeignKey(
        User, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="managed_stores"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.organization.name} — {self.name}"


class Asset(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store          = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="assets")
    name           = models.CharField(max_length=255)
    category       = models.CharField(max_length=50, choices=AssetCategory.choices, default=AssetCategory.OTHER)
    make           = models.CharField(max_length=255, blank=True)
    model_number   = models.CharField(max_length=255, blank=True)
    serial_number  = models.CharField(max_length=255, blank=True)
    install_date   = models.DateField(null=True, blank=True)
    warranty_expiry = models.DateField(null=True, blank=True)
    status         = models.CharField(max_length=50, choices=AssetStatus.choices, default=AssetStatus.OPERATIONAL)
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.store.name})"


class Part(models.Model):
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name                = models.CharField(max_length=255)
    sku                 = models.CharField(max_length=100, blank=True)
    category            = models.CharField(max_length=50, choices=PartCategory.choices, default=PartCategory.OTHER)
    asset_category      = models.CharField(max_length=50, choices=AssetCategory.choices, default=AssetCategory.OTHER)
    make                = models.CharField(max_length=255, blank=True)
    model_number        = models.CharField(max_length=255, blank=True)
    quantity_on_hand    = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=2)
    unit_price          = models.DecimalField(max_digits=10, decimal_places=2, default=0)
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
    asset         = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="tickets")
    opened_by     = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="opened_tickets"
    )
    assigned_tech = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_tickets"
    )
    symptom_code = models.CharField(max_length=50, choices=SymptomCode.choices)
    priority     = models.CharField(max_length=20, choices=TicketPriority.choices, default=TicketPriority.MEDIUM)
    status       = models.CharField(max_length=50, choices=TicketStatus.choices, default=TicketStatus.OPEN)
    sla_due_at   = models.DateTimeField(null=True, blank=True)
    closed_at    = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Ticket {self.id} — {self.symptom_code} ({self.status})"


class ServiceReport(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket          = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="service_reports")
    submitted_by    = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="service_reports"
    )
    resolution_code = models.CharField(max_length=50, choices=ResolutionCode.choices)
    labor_cost      = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    invoice_sent    = models.BooleanField(default=False)
    invoice_email   = models.EmailField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"ServiceReport {self.id} — {self.resolution_code}"

    @property
    def parts_total(self):
        return sum(p.line_total for p in self.parts_used.all())

    @property
    def grand_total(self):
        return self.labor_cost + self.parts_total


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
