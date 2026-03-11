from django.contrib.auth.models import User
from rest_framework import serializers

from .models import (
    Asset, Organization, Part, PartUsed,
    ServiceReport, Store, Ticket, UserProfile,
)


class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="profile.role", read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "role"]


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "email", "created_at"]


class StoreSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)

    class Meta:
        model = Store
        fields = ["id", "name", "address", "organization", "organization_name", "created_at"]


class AssetSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source="store.name", read_only=True)
    organization_name = serializers.CharField(source="store.organization.name", read_only=True)

    class Meta:
        model = Asset
        fields = [
            "id", "name", "serial_number", "model_number", "status",
            "store", "store_name", "organization_name", "created_at",
        ]


class PartSerializer(serializers.ModelSerializer):
    class Meta:
        model = Part
        fields = ["id", "name", "sku", "quantity_on_hand", "unit_price", "organization"]


class PartUsedSerializer(serializers.ModelSerializer):
    part_name = serializers.CharField(source="part.name", read_only=True)
    line_total = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = PartUsed
        fields = ["id", "part", "part_name", "quantity", "unit_price_at_time", "line_total"]


class PartUsedInputSerializer(serializers.Serializer):
    part_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)


class ServiceReportSerializer(serializers.ModelSerializer):
    parts_used = PartUsedSerializer(many=True, read_only=True)
    parts_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    grand_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = ServiceReport
        fields = [
            "id", "ticket", "resolution_code", "labor_cost",
            "invoice_sent", "parts_used", "parts_total", "grand_total", "created_at",
        ]


class TicketSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    store_name = serializers.CharField(source="asset.store.name", read_only=True)
    assigned_tech_name = serializers.SerializerMethodField()
    service_reports = ServiceReportSerializer(many=True, read_only=True)

    class Meta:
        model = Ticket
        fields = [
            "id", "asset", "asset_name", "store_name",
            "symptom_code", "status",
            "opened_by", "assigned_tech", "assigned_tech_name",
            "service_reports", "created_at", "updated_at",
        ]

    def get_assigned_tech_name(self, obj):
        if obj.assigned_tech:
            return obj.assigned_tech.get_full_name() or obj.assigned_tech.username
        return None


class AssignTechSerializer(serializers.Serializer):
    tech_id = serializers.IntegerField()


class CloseTicketSerializer(serializers.Serializer):
    resolution_code = serializers.ChoiceField(
        choices=ServiceReport._meta.get_field("resolution_code").choices
    )
    labor_cost = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    parts_used = PartUsedInputSerializer(many=True, required=False, default=list)
    invoice_email = serializers.EmailField(required=False, allow_blank=True)
