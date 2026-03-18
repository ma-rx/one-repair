from django.contrib.auth.models import User
from django.db import models
from rest_framework import serializers

from .models import (
    Asset, EquipmentModel, KnowledgeEntry, Organization, Part, PartRequest,
    PartRequestStatus, PartRequestUrgency, PartUsed, PricingConfig, ServiceReport,
    Store, Ticket, TicketAsset, TimeEntry, UserProfile, WorkImage,
)


class UserSerializer(serializers.ModelSerializer):
    role       = serializers.CharField(source="profile.role", read_only=True)
    is_active  = serializers.BooleanField(source="profile.is_active", read_only=True)
    store      = serializers.SerializerMethodField()
    organization = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "role", "is_active", "store", "organization"]

    def get_store(self, obj):
        try:
            s = obj.profile.store
            return {"id": str(s.id), "name": s.name} if s else None
        except UserProfile.DoesNotExist:
            return None

    def get_organization(self, obj):
        try:
            org = obj.profile.organization
            return {"id": str(org.id), "name": org.name} if org else None
        except UserProfile.DoesNotExist:
            return None


class CreateUserSerializer(serializers.Serializer):
    email        = serializers.EmailField()
    first_name   = serializers.CharField(max_length=150)
    last_name    = serializers.CharField(max_length=150, required=False, default="")
    password     = serializers.CharField(min_length=8, write_only=True)
    role         = serializers.ChoiceField(choices=["ORS_ADMIN", "CLIENT_ADMIN", "CLIENT_MANAGER", "TECH"])
    organization = serializers.UUIDField(required=False, allow_null=True)
    store        = serializers.UUIDField(required=False, allow_null=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()


# ── EquipmentModel ────────────────────────────────────────────────────────────

class EquipmentModelSerializer(serializers.ModelSerializer):
    instance_count = serializers.SerializerMethodField()

    class Meta:
        model = EquipmentModel
        fields = ["id", "make", "model_number", "model_name", "category", "description", "instance_count", "created_at", "updated_at"]

    def get_instance_count(self, obj):
        return obj.instances.filter(is_active=True).count()


# ── Organization ──────────────────────────────────────────────────────────────

class OrganizationSerializer(serializers.ModelSerializer):
    store_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id", "name", "email", "phone", "address",
            "plan", "is_active", "store_count", "created_at", "updated_at",
        ]

    def get_store_count(self, obj):
        return obj.stores.filter(is_active=True).count()


# ── Store ─────────────────────────────────────────────────────────────────────

class StoreSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    manager_name = serializers.SerializerMethodField()
    asset_count = serializers.SerializerMethodField()

    class Meta:
        model = Store
        fields = [
            "id", "name",
            "address_line1", "address_line2", "city", "state", "zip_code", "country",
            "phone", "email",
            "organization", "organization_name",
            "manager", "manager_name",
            "is_active", "asset_count",
            "created_at", "updated_at",
        ]

    def get_manager_name(self, obj):
        if obj.manager:
            return obj.manager.get_full_name() or obj.manager.username
        return None

    def get_asset_count(self, obj):
        return obj.assets.filter(is_active=True).count()


# ── Asset ─────────────────────────────────────────────────────────────────────

class AssetSerializer(serializers.ModelSerializer):
    store_name         = serializers.CharField(source="store.name", read_only=True)
    organization_name  = serializers.CharField(source="store.organization.name", read_only=True)
    equipment_model_display = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = [
            "id", "name", "category", "make", "model_number", "serial_number",
            "install_date", "warranty_expiry", "status", "is_active",
            "store", "store_name", "organization_name",
            "equipment_model", "equipment_model_display",
            "created_at", "updated_at",
        ]

    def get_equipment_model_display(self, obj):
        if obj.equipment_model:
            return {"id": str(obj.equipment_model.id), "make": obj.equipment_model.make, "model_number": obj.equipment_model.model_number}
        return None


# ── Part ──────────────────────────────────────────────────────────────────────

class PartSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Part
        fields = [
            "id", "name", "sku", "category", "asset_category",
            "make", "model_number",
            "quantity_on_hand", "low_stock_threshold", "unit_price",
            "selling_price", "vendor",
            "is_low_stock", "created_at", "updated_at",
        ]


# ── PartUsed ──────────────────────────────────────────────────────────────────

class PartUsedSerializer(serializers.ModelSerializer):
    part_name = serializers.CharField(source="part.name", read_only=True)
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = PartUsed
        fields = ["id", "part", "part_name", "quantity", "unit_price_at_time", "line_total"]


class PartUsedInputSerializer(serializers.Serializer):
    part_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)


# ── PricingConfig ─────────────────────────────────────────────────────────────

class PricingConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingConfig
        fields = ["id", "trip_charge", "hourly_rate", "min_hours", "updated_at"]


# ── TimeEntry ─────────────────────────────────────────────────────────────────

class TimeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeEntry
        fields = ["id", "ticket", "clocked_in_at", "clocked_out_at", "total_minutes", "created_at"]


# ── WorkImage ─────────────────────────────────────────────────────────────────

class WorkImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkImage
        fields = ["id", "ticket", "url", "created_at"]


# ── ServiceReport ─────────────────────────────────────────────────────────────

class ServiceReportSerializer(serializers.ModelSerializer):
    parts_used = PartUsedSerializer(many=True, read_only=True)
    parts_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    grand_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = ServiceReport
        fields = [
            "id", "ticket", "resolution_code", "labor_cost",
            "invoice_sent", "invoice_email",
            "tech_notes", "formatted_report",
            "parts_used", "parts_total", "grand_total", "created_at",
        ]


# ── TicketAsset ───────────────────────────────────────────────────────────────

class TicketAssetSerializer(serializers.ModelSerializer):
    asset_name = serializers.SerializerMethodField()

    class Meta:
        model = TicketAsset
        fields = ["id", "asset", "asset_name", "asset_description", "symptom_code", "resolution_code", "created_at"]

    def get_asset_name(self, obj):
        if obj.asset:
            return obj.asset.name
        return obj.asset_description or "Unlisted Equipment"


# ── Ticket ────────────────────────────────────────────────────────────────────

class TicketSerializer(serializers.ModelSerializer):
    asset_name         = serializers.SerializerMethodField()
    store_name         = serializers.SerializerMethodField()
    store_address      = serializers.SerializerMethodField()
    assigned_tech_name = serializers.SerializerMethodField()
    service_reports    = ServiceReportSerializer(many=True, read_only=True)
    assets             = TicketAssetSerializer(source="ticket_assets", many=True, read_only=True)
    needs_coding       = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            "id", "asset", "asset_name", "asset_description",
            "store", "store_name", "store_address",
            "symptom_code", "description", "priority", "status", "scheduled_date",
            "opened_by", "assigned_tech", "assigned_tech_name",
            "sla_due_at", "closed_at",
            "assets", "needs_coding", "service_reports", "created_at", "updated_at",
        ]

    def get_asset_name(self, obj):
        first = obj.ticket_assets.select_related("asset").first()
        if first:
            return first.asset.name if first.asset else (first.asset_description or "Unlisted Equipment")
        if obj.asset:
            return obj.asset.name
        return obj.asset_description or "Unlisted Equipment"

    def get_store_name(self, obj):
        if obj.store:
            return obj.store.name
        if obj.asset and obj.asset.store:
            return obj.asset.store.name
        return ""

    def get_store_address(self, obj):
        store = obj.store or (obj.asset.store if obj.asset else None)
        if not store:
            return ""
        parts = [store.address_line1, store.city, store.state, store.zip_code]
        return ", ".join(p for p in parts if p)

    def get_assigned_tech_name(self, obj):
        if obj.assigned_tech:
            return obj.assigned_tech.get_full_name() or obj.assigned_tech.username
        return None

    def get_needs_coding(self, obj):
        """True if ticket is closed but any TicketAsset is missing symptom or resolution code."""
        if obj.status != "CLOSED":
            return False
        return obj.ticket_assets.filter(
            models.Q(symptom_code="") | models.Q(resolution_code="")
        ).exists()


# ── PartRequest ───────────────────────────────────────────────────────────────

class PartRequestSerializer(serializers.ModelSerializer):
    part_name_display = serializers.SerializerMethodField()
    ticket_summary    = serializers.SerializerMethodField()

    class Meta:
        model = PartRequest
        fields = [
            "id", "ticket", "ticket_summary",
            "part", "part_name_display",
            "part_name", "sku", "asset_category", "make", "model_number",
            "vendor", "cost_price", "selling_price",
            "quantity_needed", "urgency", "notes",
            "status", "tracking_number",
            "approved_by_ors_at", "approved_by_client_at", "ordered_at", "delivered_at",
            "created_at", "updated_at",
        ]

    def get_part_name_display(self, obj):
        return obj.part.name if obj.part else obj.part_name

    def get_ticket_summary(self, obj):
        t = obj.ticket
        first_ta = t.ticket_assets.filter(asset__isnull=False).first()
        if first_ta:
            asset_name = first_ta.asset.name
        else:
            any_ta = t.ticket_assets.first()
            asset_name = any_ta.asset_description if any_ta else ""
        return {
            "id": str(t.id),
            "store_name": t.store.name if t.store else "",
            "asset_name": asset_name,
            "status": t.status,
        }


# ── Action serializers ────────────────────────────────────────────────────────

class AssignTechSerializer(serializers.Serializer):
    tech_id        = serializers.IntegerField()
    scheduled_date = serializers.DateField(required=False, allow_null=True)


class PartRequestInputSerializer(serializers.Serializer):
    part_id        = serializers.UUIDField(required=False, allow_null=True)
    part_name      = serializers.CharField(required=False, allow_blank=True, default="")
    sku            = serializers.CharField(required=False, allow_blank=True, default="")
    asset_category = serializers.CharField(required=False, allow_blank=True, default="")
    make           = serializers.CharField(required=False, allow_blank=True, default="")
    model_number   = serializers.CharField(required=False, allow_blank=True, default="")
    vendor         = serializers.CharField(required=False, allow_blank=True, default="")
    cost_price     = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    selling_price  = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    quantity_needed = serializers.IntegerField(min_value=1, default=1)
    urgency        = serializers.ChoiceField(choices=["ASAP", "NEXT_VISIT"], default="NEXT_VISIT")
    notes          = serializers.CharField(required=False, allow_blank=True, default="")


# ── KnowledgeEntry ────────────────────────────────────────────────────────────

class KnowledgeEntrySerializer(serializers.ModelSerializer):
    contributed_by_name     = serializers.SerializerMethodField()
    equipment_model_display = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeEntry
        fields = [
            "id", "equipment_model", "equipment_model_display",
            "asset_category", "make", "model_number",
            "symptom_code", "resolution_code", "difficulty",
            "cause_summary", "procedure", "parts_commonly_used", "pro_tips",
            "contributed_by", "contributed_by_name", "is_verified",
            "created_at", "updated_at",
        ]

    def get_contributed_by_name(self, obj):
        if obj.contributed_by:
            return obj.contributed_by.get_full_name() or obj.contributed_by.username
        return None

    def get_equipment_model_display(self, obj):
        if obj.equipment_model:
            return {"id": str(obj.equipment_model.id), "make": obj.equipment_model.make, "model_number": obj.equipment_model.model_number}
        return None


class CloseTicketSerializer(serializers.Serializer):
    resolution_code  = serializers.ChoiceField(
        choices=ServiceReport._meta.get_field("resolution_code").choices,
        required=False, default="OTHER",
    )
    labor_cost       = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True, default=None)
    parts_used       = PartUsedInputSerializer(many=True, required=False, default=list)
    parts_needed     = PartRequestInputSerializer(many=True, required=False, default=list)
    invoice_email    = serializers.EmailField(required=False, allow_blank=True)
    tech_notes       = serializers.CharField(required=False, allow_blank=True, default="")
    formatted_report = serializers.CharField(required=False, allow_blank=True, default="")
