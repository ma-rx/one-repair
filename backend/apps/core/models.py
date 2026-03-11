import uuid
from django.db import models


class SymptomCode(models.TextChoices):
    NO_POWER = "NO_POWER", "No Power"
    WONT_START = "WONT_START", "Won't Start"
    OVERHEATING = "OVERHEATING", "Overheating"
    UNUSUAL_NOISE = "UNUSUAL_NOISE", "Unusual Noise"
    LEAKING = "LEAKING", "Leaking"
    NOT_COOLING = "NOT_COOLING", "Not Cooling"
    NOT_HEATING = "NOT_HEATING", "Not Heating"
    DISPLAY_ISSUE = "DISPLAY_ISSUE", "Display Issue"
    ERROR_CODE_DISPLAYED = "ERROR_CODE_DISPLAYED", "Error Code Displayed"
    CONNECTIVITY_ISSUE = "CONNECTIVITY_ISSUE", "Connectivity Issue"
    PHYSICAL_DAMAGE = "PHYSICAL_DAMAGE", "Physical Damage"
    SLOW_PERFORMANCE = "SLOW_PERFORMANCE", "Slow Performance"
    OTHER = "OTHER", "Other"


class ResolutionCode(models.TextChoices):
    REPLACED_PART = "REPLACED_PART", "Replaced Part"
    REPAIRED_IN_FIELD = "REPAIRED_IN_FIELD", "Repaired in Field"
    ADJUSTED_SETTINGS = "ADJUSTED_SETTINGS", "Adjusted Settings"
    FIRMWARE_UPDATE = "FIRMWARE_UPDATE", "Firmware Update"
    CLEANED_SERVICED = "CLEANED_SERVICED", "Cleaned / Serviced"
    REPROGRAMMED = "REPROGRAMMED", "Reprogrammed"
    PREVENTIVE_MAINTENANCE = "PREVENTIVE_MAINTENANCE", "Preventive Maintenance"
    AWAITING_PARTS = "AWAITING_PARTS", "Awaiting Parts"
    REFERRED_TO_VENDOR = "REFERRED_TO_VENDOR", "Referred to Vendor"
    NO_FAULT_FOUND = "NO_FAULT_FOUND", "No Fault Found"
    OTHER = "OTHER", "Other"


class TicketStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    PENDING_PARTS = "PENDING_PARTS", "Pending Parts"
    RESOLVED = "RESOLVED", "Resolved"
    CLOSED = "CLOSED", "Closed"
    CANCELLED = "CANCELLED", "Cancelled"


class AssetStatus(models.TextChoices):
    OPERATIONAL = "OPERATIONAL", "Operational"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE", "Under Maintenance"
    OUT_OF_SERVICE = "OUT_OF_SERVICE", "Out of Service"
    DECOMMISSIONED = "DECOMMISSIONED", "Decommissioned"


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Store(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="stores"
    )
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.organization.name} — {self.name}"


class Asset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="assets")
    name = models.CharField(max_length=255)
    serial_number = models.CharField(max_length=255, blank=True)
    model_number = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=50, choices=AssetStatus.choices, default=AssetStatus.OPERATIONAL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.store.name})"


class Ticket(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="tickets")
    symptom_code = models.CharField(max_length=50, choices=SymptomCode.choices)
    status = models.CharField(
        max_length=50, choices=TicketStatus.choices, default=TicketStatus.OPEN
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Ticket {self.id} — {self.symptom_code} ({self.status})"


class ServiceReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="service_reports"
    )
    resolution_code = models.CharField(max_length=50, choices=ResolutionCode.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"ServiceReport {self.id} — {self.resolution_code}"
