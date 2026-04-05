from django.contrib.auth.models import User
from django.db import models
from rest_framework import serializers

from .models import (
    Asset, DistrictManager, EquipmentModel, KnowledgeEntry, Organization, Part, PartRequest,
    PartsApproval, PartRequestUrgency, PartUsed, PricingConfig, RepairDocument, RepairImage,
    ResolutionCodeEntry, ServiceReport, Store, Ticket, TicketAsset, TimeEntry,
    UserProfile, WorkImage, SymptomCodeEntry,
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
        if hasattr(obj, "instance_count"):
            return obj.instance_count
        return obj.instances.filter(is_active=True).count()


# ── Organization ──────────────────────────────────────────────────────────────

class OrganizationSerializer(serializers.ModelSerializer):
    store_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id", "name", "email", "phone", "address",
            "plan", "is_active", "code", "nte_limit",
            "payment_terms", "invoice_emails",
            "store_count", "created_at", "updated_at",
        ]

    def get_store_count(self, obj):
        if hasattr(obj, "store_count"):
            return obj.store_count
        return obj.stores.filter(is_active=True).count()


# ── DistrictManager ───────────────────────────────────────────────────────────

class DistrictManagerSerializer(serializers.ModelSerializer):
    class Meta:
        model = DistrictManager
        fields = ["id", "organization", "name", "phone", "email", "created_at", "updated_at"]


# ── Store ─────────────────────────────────────────────────────────────────────

class StoreSerializer(serializers.ModelSerializer):
    organization_name        = serializers.CharField(source="organization.name", read_only=True)
    manager_name             = serializers.SerializerMethodField()
    district_manager_name    = serializers.SerializerMethodField()
    district_manager_phone   = serializers.SerializerMethodField()
    district_manager_email   = serializers.SerializerMethodField()
    asset_count              = serializers.SerializerMethodField()

    class Meta:
        model = Store
        fields = [
            "id", "name",
            "address_line1", "address_line2", "city", "state", "zip_code", "country",
            "phone", "email", "hours",
            "organization", "organization_name",
            "manager", "manager_name",
            "district_manager", "district_manager_name", "district_manager_phone", "district_manager_email",
            "tax_rate", "is_active", "asset_count",
            "created_at", "updated_at",
        ]

    def get_manager_name(self, obj):
        if obj.manager:
            return obj.manager.get_full_name() or obj.manager.username
        return None

    def get_district_manager_name(self, obj):
        return obj.district_manager.name if obj.district_manager else None

    def get_district_manager_phone(self, obj):
        return obj.district_manager.phone if obj.district_manager else None

    def get_district_manager_email(self, obj):
        return obj.district_manager.email if obj.district_manager else None

    def get_asset_count(self, obj):
        if hasattr(obj, "asset_count"):
            return obj.asset_count
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
            return {"id": str(obj.equipment_model.id), "make": obj.equipment_model.make, "model_number": obj.equipment_model.model_number, "model_name": obj.equipment_model.model_name}
        return None


# ── Part ──────────────────────────────────────────────────────────────────────

class PartSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)
    compatible_models_display = serializers.SerializerMethodField()
    compatible_model_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False, default=list
    )

    class Meta:
        model = Part
        fields = [
            "id", "name", "sku", "asset_category",
            "make",
            "quantity_on_hand", "low_stock_threshold", "unit_price",
            "selling_price", "vendor",
            "compatible_models_display", "compatible_model_ids",
            "is_low_stock", "created_at", "updated_at",
        ]

    def get_compatible_models_display(self, obj):
        return [
            {"id": str(m.id), "make": m.make, "model_number": m.model_number, "model_name": m.model_name}
            for m in obj.compatible_models.all()
        ]

    def _set_compatible_models(self, instance, ids):
        if ids is not None:
            models_qs = EquipmentModel.objects.filter(id__in=ids)
            instance.compatible_models.set(models_qs)

    def create(self, validated_data):
        ids = validated_data.pop("compatible_model_ids", [])
        instance = super().create(validated_data)
        self._set_compatible_models(instance, ids)
        return instance

    def update(self, instance, validated_data):
        ids = validated_data.pop("compatible_model_ids", None)
        instance = super().update(instance, validated_data)
        self._set_compatible_models(instance, ids)
        return instance


# ── PartUsed ──────────────────────────────────────────────────────────────────

class PartUsedSerializer(serializers.ModelSerializer):
    part_name = serializers.CharField(source="part.name", read_only=True)
    part_sku  = serializers.CharField(source="part.sku",  read_only=True)
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = PartUsed
        fields = ["id", "part", "part_name", "part_sku", "quantity", "unit_price_at_time", "line_total"]


class PartUsedInputSerializer(serializers.Serializer):
    part_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)


# ── PricingConfig ─────────────────────────────────────────────────────────────

class PricingConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingConfig
        fields = [
            "id", "trip_charge", "hourly_rate", "min_hours", "tax_rate",
            "company_name", "company_address", "company_phone", "company_email", "logo_url",
            "updated_at",
        ]


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
    parts_used    = PartUsedSerializer(many=True, read_only=True)
    parts_total   = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    sales_tax     = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    grand_total   = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    ticket_status = serializers.SerializerMethodField()
    ticket_number = serializers.SerializerMethodField()
    org_name      = serializers.SerializerMethodField()
    store_name    = serializers.SerializerMethodField()
    asset_name    = serializers.SerializerMethodField()

    def get_ticket_status(self, obj):
        return obj.ticket.status if obj.ticket_id else None

    def get_ticket_number(self, obj):
        return obj.ticket.ticket_number if obj.ticket_id else None

    def get_org_name(self, obj):
        try:
            store = obj.ticket.asset.store if obj.ticket.asset_id else None
            if not store:
                ta = obj.ticket.ticket_assets.select_related("asset__store__organization").first()
                store = ta.asset.store if ta and ta.asset_id else None
            return store.organization.name if store and store.organization_id else None
        except Exception:
            return None

    def get_store_name(self, obj):
        try:
            store = obj.ticket.asset.store if obj.ticket.asset_id else None
            if not store:
                ta = obj.ticket.ticket_assets.select_related("asset__store").first()
                store = ta.asset.store if ta and ta.asset_id else None
            return store.name if store else None
        except Exception:
            return None

    def get_asset_name(self, obj):
        try:
            if obj.ticket.asset_id:
                return obj.ticket.asset.name
            ta = obj.ticket.ticket_assets.select_related("asset").first()
            if ta:
                return ta.asset.name if ta.asset_id else (ta.asset_description or None)
            return obj.ticket.asset_description or None
        except Exception:
            return None

    class Meta:
        model = ServiceReport
        fields = [
            "id", "ticket", "ticket_status", "ticket_number", "org_name", "store_name", "asset_name",
            "resolution_code", "trip_charge", "labor_cost",
            "invoice_sent", "invoice_email",
            "tech_notes", "formatted_report", "manager_on_site", "manager_signature",
            "draft_parts", "extra_line_items", "tax_rate", "sales_tax",
            "stripe_session_id", "stripe_payment_url",
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
    asset_name                   = serializers.SerializerMethodField()
    asset_category               = serializers.SerializerMethodField()
    asset_make                   = serializers.SerializerMethodField()
    asset_model_number           = serializers.SerializerMethodField()
    store_name                   = serializers.SerializerMethodField()
    store_address                = serializers.SerializerMethodField()
    store_phone                  = serializers.SerializerMethodField()
    store_hours                  = serializers.SerializerMethodField()
    store_district_manager_name  = serializers.SerializerMethodField()
    store_district_manager_phone = serializers.SerializerMethodField()
    assigned_tech_name           = serializers.SerializerMethodField()
    service_reports              = ServiceReportSerializer(many=True, read_only=True)
    assets                       = TicketAssetSerializer(source="ticket_assets", many=True, read_only=True)
    needs_coding                 = serializers.SerializerMethodField()
    parts_approval_status        = serializers.SerializerMethodField()
    has_service_report           = serializers.SerializerMethodField()
    total_labor_minutes          = serializers.SerializerMethodField()
    org_invoice_emails           = serializers.SerializerMethodField()
    default_tax_rate             = serializers.SerializerMethodField()
    invoice_sent                 = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            "id", "ticket_number", "asset", "asset_name", "asset_description",
            "asset_category", "asset_make", "asset_model_number",
            "store", "store_name", "store_address", "store_phone", "store_hours",
            "store_district_manager_name", "store_district_manager_phone",
            "symptom_code", "description", "priority", "status", "scheduled_date",
            "route_order",
            "opened_by", "assigned_tech", "assigned_tech_name",
            "sla_due_at", "completed_at", "closed_at",
            "assets", "needs_coding", "parts_approval_status",
            "has_service_report", "total_labor_minutes",
            "service_reports", "org_invoice_emails", "default_tax_rate",
            "invoice_sent",
            "created_at", "updated_at",
        ]

    def _get_store(self, obj):
        return obj.store or (obj.asset.store if obj.asset else None)

    def _get_primary_asset(self, obj):
        first = obj.ticket_assets.select_related("asset").first()
        if first and first.asset:
            return first.asset
        return obj.asset

    def get_asset_name(self, obj):
        first = obj.ticket_assets.select_related("asset").first()
        if first:
            return first.asset.name if first.asset else (first.asset_description or "Unlisted Equipment")
        if obj.asset:
            return obj.asset.name
        return obj.asset_description or "Unlisted Equipment"

    def get_asset_category(self, obj):
        asset = self._get_primary_asset(obj)
        return asset.category if asset else ""

    def get_asset_make(self, obj):
        asset = self._get_primary_asset(obj)
        return asset.make if asset else ""

    def get_asset_model_number(self, obj):
        asset = self._get_primary_asset(obj)
        return asset.model_number if asset else ""

    def get_store_name(self, obj):
        store = self._get_store(obj)
        return store.name if store else ""

    def get_store_address(self, obj):
        store = self._get_store(obj)
        if not store:
            return ""
        parts = [store.address_line1, store.city, store.state, store.zip_code]
        return ", ".join(p for p in parts if p)

    def get_store_phone(self, obj):
        store = self._get_store(obj)
        return store.phone if store else ""

    def get_store_hours(self, obj):
        store = self._get_store(obj)
        return store.hours if store else ""

    def get_store_district_manager_name(self, obj):
        store = self._get_store(obj)
        return store.district_manager.name if store and store.district_manager else None

    def get_store_district_manager_phone(self, obj):
        store = self._get_store(obj)
        return store.district_manager.phone if store and store.district_manager else None

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

    def get_parts_approval_status(self, obj):
        """Returns the status of the most recent active (non-PENDING) parts approval."""
        pa = obj.parts_approvals.exclude(status="PENDING").order_by("-updated_at").first()
        return pa.status if pa else None

    def get_has_service_report(self, obj):
        return obj.service_reports.exists()

    def get_total_labor_minutes(self, obj):
        total = obj.time_entries.filter(clocked_out_at__isnull=False).aggregate(
            s=models.Sum("total_minutes")
        )["s"]
        return total or 0

    def get_org_invoice_emails(self, obj):
        store = obj.store or (obj.asset.store if obj.asset else None)
        org = store.organization if store else None
        return list(org.invoice_emails or []) if org else []

    def get_default_tax_rate(self, obj):
        store = obj.store or (obj.asset.store if obj.asset else None)
        if store and store.tax_rate is not None:
            return str(store.tax_rate)
        pricing = PricingConfig.objects.first()
        if pricing and pricing.tax_rate:
            return str(pricing.tax_rate)
        return "0"

    def get_invoice_sent(self, obj):
        report = obj.service_reports.first()
        return report.invoice_sent if report else False


# ── PartRequest ───────────────────────────────────────────────────────────────

class PartRequestSerializer(serializers.ModelSerializer):
    part_name_display = serializers.SerializerMethodField()

    class Meta:
        model = PartRequest
        fields = [
            "id", "parts_approval", "ticket",
            "part", "part_name_display",
            "part_name", "sku", "asset_category", "make", "model_number",
            "vendor", "cost_price", "selling_price",
            "quantity_needed", "urgency", "notes",
            "created_at", "updated_at",
        ]

    def get_part_name_display(self, obj):
        return obj.part.name if obj.part else obj.part_name


# ── PartsApproval ─────────────────────────────────────────────────────────────

class PartsApprovalSerializer(serializers.ModelSerializer):
    part_requests            = PartRequestSerializer(many=True, read_only=True)
    total_selling_price      = serializers.SerializerMethodField()
    nte_limit                = serializers.SerializerMethodField()
    requires_client_approval = serializers.SerializerMethodField()
    ticket_detail            = serializers.SerializerMethodField()
    followup_ticket_number   = serializers.SerializerMethodField()

    class Meta:
        model = PartsApproval
        fields = [
            "id", "ticket", "ticket_detail", "status",
            "notes_for_client", "denied_reason", "tracking_number",
            "followup_ticket", "followup_ticket_number",
            "total_selling_price", "nte_limit", "requires_client_approval",
            "part_requests",
            "sent_at", "approved_at", "denied_at", "ordered_at", "delivered_at",
            "created_at", "updated_at",
        ]

    def get_total_selling_price(self, obj):
        from decimal import Decimal
        return str(sum(
            (pr.selling_price or Decimal("0")) * pr.quantity_needed
            for pr in obj.part_requests.all()
        ))

    def get_nte_limit(self, obj):
        try:
            return str(obj.ticket.store.organization.nte_limit)
        except Exception:
            return "500.00"

    def get_requires_client_approval(self, obj):
        try:
            total = sum(
                (pr.selling_price or 0) * pr.quantity_needed
                for pr in obj.part_requests.all()
            )
            nte = obj.ticket.store.organization.nte_limit
            return total > nte
        except Exception:
            return False

    def get_followup_ticket_number(self, obj):
        if obj.followup_ticket:
            return obj.followup_ticket.ticket_number or str(obj.followup_ticket.id)[:8]
        return None

    def get_ticket_detail(self, obj):
        t = obj.ticket
        first_ta = t.ticket_assets.select_related("asset").first()
        if first_ta:
            asset_name = first_ta.asset.name if first_ta.asset else first_ta.asset_description
        else:
            asset_name = t.asset.name if t.asset else (t.asset_description or "Unknown")
        sr = t.service_reports.order_by("-created_at").first()
        return {
            "id": str(t.id),
            "ticket_number": t.ticket_number,
            "store_name": t.store.name if t.store else "",
            "asset_name": asset_name,
            "symptom_code": t.symptom_code,
            "tech_notes": sr.tech_notes if sr else "",
            "formatted_report": sr.formatted_report if sr else "",
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
            "symptom_code", "symptom_description", "diagnostic_steps",
            "difficulty", "cause_summary", "parts_commonly_used", "pro_tips",
            "contributed_by", "contributed_by_name", "is_verified",
            "created_at", "updated_at",
        ]

    def get_contributed_by_name(self, obj):
        if obj.contributed_by:
            return obj.contributed_by.get_full_name() or obj.contributed_by.username
        return None

    def get_equipment_model_display(self, obj):
        if obj.equipment_model:
            return {"id": str(obj.equipment_model.id), "make": obj.equipment_model.make, "model_number": obj.equipment_model.model_number, "model_name": obj.equipment_model.model_name}
        return None


# ── SymptomCodeEntry / ResolutionCodeEntry ────────────────────────────────────

class SymptomCodeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = SymptomCodeEntry
        fields = ["id", "code", "label", "make", "asset_category", "is_active", "sort_order", "created_at", "updated_at"]


class ResolutionCodeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ResolutionCodeEntry
        fields = ["id", "code", "label", "make", "asset_category", "is_active", "sort_order", "created_at", "updated_at"]


class RepairDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    is_embedded = serializers.SerializerMethodField()

    class Meta:
        model = RepairDocument
        fields = ["id", "title", "make", "content", "uploaded_by", "uploaded_by_name", "is_embedded", "created_at"]
        read_only_fields = ["uploaded_by"]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return None

    def get_is_embedded(self, obj):
        return obj.chunks.filter(embedding__isnull=False).exists()


class VerifiedAnswerSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    is_embedded     = serializers.SerializerMethodField()

    class Meta:
        from .models import VerifiedAnswer
        model  = VerifiedAnswer
        fields = ["id", "question", "answer", "make", "asset_category", "aliases", "created_by", "created_by_name", "is_embedded", "created_at", "updated_at"]
        read_only_fields = ["created_by"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_is_embedded(self, obj):
        return obj.embedding is not None


class RepairImageSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = RepairImage
        fields = ["id", "title", "url", "tags", "make", "asset_category", "uploaded_by", "uploaded_by_name", "created_at"]
        read_only_fields = ["uploaded_by", "url"]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
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
    manager_on_site      = serializers.CharField(required=False, allow_blank=True, default="")
    manager_signature    = serializers.CharField(required=False, allow_blank=True, default="")


class SaveProgressSerializer(serializers.Serializer):
    resolution_code  = serializers.ChoiceField(
        choices=ServiceReport._meta.get_field("resolution_code").choices,
        required=False, default="OTHER",
    )
    labor_cost       = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True, default=None)
    parts_used       = PartUsedInputSerializer(many=True, required=False, default=list)
    parts_needed     = PartRequestInputSerializer(many=True, required=False, default=list)
    tech_notes       = serializers.CharField(required=False, allow_blank=True, default="")
    formatted_report = serializers.CharField(required=False, allow_blank=True, default="")
    manager_on_site      = serializers.CharField(required=False, allow_blank=True, default="")
    manager_signature    = serializers.CharField(required=False, allow_blank=True, default="")


class GenerateInvoiceSerializer(serializers.Serializer):
    resolution_code  = serializers.ChoiceField(
        choices=ServiceReport._meta.get_field("resolution_code").choices,
        required=False, default="OTHER",
    )
    labor_cost       = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True, default=None)
    tax_rate         = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True, default=None)
    parts_used       = PartUsedInputSerializer(many=True, required=False, default=list)
    invoice_email    = serializers.EmailField(required=False, allow_blank=True, default="")
    tech_notes       = serializers.CharField(required=False, allow_blank=True, default="")
    formatted_report = serializers.CharField(required=False, allow_blank=True, default="")
