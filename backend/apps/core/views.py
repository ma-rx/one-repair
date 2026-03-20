from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Avg, Count, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

import uuid as uuid_module

import requests as http_requests
from rest_framework.parsers import MultiPartParser

from .models import (
    Asset, AssetStatus, EquipmentModel, KnowledgeEntry, Organization, Part,
    PartRequest, PartRequestStatus, PartUsed, PricingConfig, ResolutionCodeEntry,
    ServiceReport, Store, Ticket, TicketAsset, TicketStatus, TimeEntry, UserRole,
    WorkImage, SymptomCodeEntry,
)
from .permissions import IsClientAdmin, IsClientAdminOrManager, IsORSAdmin
from .serializers import (
    AssetSerializer, AssignTechSerializer, CloseTicketSerializer,
    CreateUserSerializer, EquipmentModelSerializer, GenerateInvoiceSerializer,
    KnowledgeEntrySerializer,
    OrganizationSerializer, PartRequestSerializer, PartSerializer,
    PricingConfigSerializer, ResolutionCodeEntrySerializer, SaveProgressSerializer,
    ServiceReportSerializer,
    StoreSerializer, SymptomCodeEntrySerializer, TicketAssetSerializer,
    TicketSerializer, TimeEntrySerializer, UserSerializer, WorkImageSerializer,
)
from .services.email_service import send_invoice_email
from .services.invoice import generate_invoice_pdf


# ── Users ─────────────────────────────────────────────────────────────────────

class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        if self.action in ["create", "partial_update", "deactivate"]:
            return [IsClientAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = User.objects.select_related("profile__organization", "profile__store")
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(profile__role=role)
        user = self.request.user
        if hasattr(user, "profile") and user.profile.role != UserRole.ORS_ADMIN:
            qs = qs.filter(profile__organization=user.profile.organization)
        return qs.order_by("first_name", "last_name")

    def create(self, request, *args, **kwargs):
        ser = CreateUserSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        # Resolve org — CLIENT_ADMIN can only create within their own org
        requesting_profile = request.user.profile
        if requesting_profile.role == UserRole.ORS_ADMIN:
            org = None
            if d.get("organization"):
                from .models import Organization
                try:
                    org = Organization.objects.get(pk=d["organization"])
                except Organization.DoesNotExist:
                    return Response({"detail": "Organization not found."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            org = requesting_profile.organization

        # Resolve store (optional, for CLIENT_MANAGER)
        store = None
        if d.get("store"):
            try:
                store = Store.objects.get(pk=d["store"])
            except Store.DoesNotExist:
                return Response({"detail": "Store not found."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = User.objects.create_user(
                username=d["email"],
                email=d["email"],
                password=d["password"],
                first_name=d["first_name"],
                last_name=d.get("last_name", ""),
            )
            UserProfile.objects.create(
                user=user,
                role=d["role"],
                organization=org,
                store=store,
            )

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        d = request.data

        # Update User model fields
        user_fields = []
        if "first_name" in d:
            user.first_name = d["first_name"]
            user_fields.append("first_name")
        if "last_name" in d:
            user.last_name = d["last_name"]
            user_fields.append("last_name")
        if "email" in d:
            user.email = d["email"]
            user.username = d["email"]
            user_fields += ["email", "username"]
        if "password" in d and d["password"]:
            user.set_password(d["password"])
            user_fields.append("password")
        if user_fields:
            user.save(update_fields=user_fields)

        # Update profile fields
        profile = user.profile
        profile_fields = []
        if "role" in d:
            profile.role = d["role"]
            profile_fields.append("role")
        if "organization" in d:
            if d["organization"]:
                try:
                    from .models import Organization
                    profile.organization = Organization.objects.get(pk=d["organization"])
                except Organization.DoesNotExist:
                    return Response({"detail": "Organization not found."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                profile.organization = None
            profile_fields.append("organization")
        if "store" in d:
            if d["store"]:
                try:
                    profile.store = Store.objects.get(pk=d["store"])
                except Store.DoesNotExist:
                    return Response({"detail": "Store not found."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                profile.store = None
            profile_fields.append("store")
        if profile_fields:
            profile.save(update_fields=profile_fields)

        user.refresh_from_db()
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=["patch"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        user = self.get_object()
        profile = user.profile
        profile.is_active = not profile.is_active
        profile.save(update_fields=["is_active"])
        return Response(UserSerializer(user).data)


# ── Organizations ─────────────────────────────────────────────────────────────

class OrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsORSAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "profile") and user.profile.role == UserRole.ORS_ADMIN:
            return Organization.objects.prefetch_related("stores").all()
        # Other roles see only their own org
        if hasattr(user, "profile") and user.profile.organization:
            return Organization.objects.filter(id=user.profile.organization_id)
        return Organization.objects.none()


# ── Stores ────────────────────────────────────────────────────────────────────

class StoreViewSet(viewsets.ModelViewSet):
    serializer_class = StoreSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsClientAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "profile") and user.profile.role == UserRole.ORS_ADMIN:
            qs = Store.objects.select_related("organization", "manager").prefetch_related("assets")
        elif hasattr(user, "profile") and user.profile.organization:
            qs = Store.objects.filter(
                organization=user.profile.organization
            ).select_related("organization", "manager").prefetch_related("assets")
        else:
            return Store.objects.none()

        org_id = self.request.query_params.get("organization")
        if org_id:
            qs = qs.filter(organization_id=org_id)

        active_only = self.request.query_params.get("active")
        if active_only == "true":
            qs = qs.filter(is_active=True)

        return qs


# ── EquipmentModel ────────────────────────────────────────────────────────────

class EquipmentModelViewSet(viewsets.ModelViewSet):
    serializer_class = EquipmentModelSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsORSAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = EquipmentModel.objects.prefetch_related("instances")
        if self.request.query_params.get("category"):
            qs = qs.filter(category=self.request.query_params["category"])
        return qs


# ── Assets ────────────────────────────────────────────────────────────────────

class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsClientAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "profile") and user.profile.role == UserRole.ORS_ADMIN:
            qs = Asset.objects.select_related("store__organization")
        elif hasattr(user, "profile") and user.profile.organization:
            qs = Asset.objects.filter(
                store__organization=user.profile.organization
            ).select_related("store__organization")
        else:
            return Asset.objects.none()

        store_id = self.request.query_params.get("store")
        if store_id:
            qs = qs.filter(store_id=store_id)

        equipment_model_id = self.request.query_params.get("equipment_model")
        if equipment_model_id:
            qs = qs.filter(equipment_model_id=equipment_model_id)

        active_only = self.request.query_params.get("active")
        if active_only == "true":
            qs = qs.filter(is_active=True)

        return qs


# ── Parts ─────────────────────────────────────────────────────────────────────

class PartViewSet(viewsets.ModelViewSet):
    serializer_class = PartSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsORSAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Part.objects.prefetch_related("compatible_models")
        asset_category = self.request.query_params.get("asset_category")
        make = self.request.query_params.get("make")
        compatible_model = self.request.query_params.get("compatible_model")
        if asset_category:
            qs = qs.filter(asset_category=asset_category)
        if make:
            qs = qs.filter(make__iexact=make)
        if compatible_model:
            qs = qs.filter(compatible_models__id=compatible_model)
        return qs


# ── Tickets ───────────────────────────────────────────────────────────────────

class TicketViewSet(viewsets.ModelViewSet):
    serializer_class = TicketSerializer

    def get_permissions(self):
        if self.action == "destroy":
            return [IsORSAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, "profile", None)

        base = Ticket.objects.select_related(
            "asset__store__organization", "store__organization", "assigned_tech"
        ).prefetch_related("service_reports__parts_used__part", "ticket_assets__asset")

        if profile is None:
            return Ticket.objects.none()

        if profile.role == UserRole.ORS_ADMIN:
            qs = base
        elif profile.role == UserRole.TECH:
            qs = base.filter(assigned_tech=user)
        elif profile.role == UserRole.CLIENT_MANAGER and profile.store:
            qs = base.filter(store=profile.store)
        elif profile.organization:
            qs = base.filter(store__organization=profile.organization)
        else:
            return Ticket.objects.none()

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        date_filter = self.request.query_params.get("date")
        if date_filter:
            qs = qs.filter(scheduled_date=date_filter)

        month_filter = self.request.query_params.get("month")  # format: YYYY-MM
        if month_filter:
            try:
                year, month = month_filter.split("-")
                qs = qs.filter(scheduled_date__year=int(year), scheduled_date__month=int(month))
            except (ValueError, AttributeError):
                pass

        return qs

    def perform_create(self, serializer):
        asset = serializer.validated_data.get("asset")
        store = serializer.validated_data.get("store")
        if asset and not store:
            store = asset.store
        serializer.save(store=store)

    @action(detail=True, methods=["patch"], url_path="assign")
    def assign(self, request, pk=None):
        ticket = self.get_object()

        if ticket.status == TicketStatus.CLOSED:
            return Response(
                {"detail": "Cannot assign a closed ticket."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AssignTechSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            tech = User.objects.get(pk=serializer.validated_data["tech_id"])
        except User.DoesNotExist:
            return Response({"detail": "Technician not found."}, status=status.HTTP_404_NOT_FOUND)

        ticket.assigned_tech = tech
        if serializer.validated_data.get("scheduled_date") is not None:
            ticket.scheduled_date = serializer.validated_data["scheduled_date"]
        ticket.status = TicketStatus.DISPATCHED
        ticket.save(update_fields=["assigned_tech", "status", "scheduled_date", "updated_at"])

        return Response(TicketSerializer(ticket).data)

    @action(detail=True, methods=["patch"], url_path="reschedule")
    def reschedule(self, request, pk=None):
        ticket = self.get_object()
        scheduled_date = request.data.get("scheduled_date")
        if not scheduled_date:
            return Response({"detail": "scheduled_date is required."}, status=status.HTTP_400_BAD_REQUEST)
        ticket.scheduled_date = scheduled_date
        ticket.save(update_fields=["scheduled_date", "updated_at"])
        return Response(TicketSerializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="add-asset")
    def add_asset(self, request, pk=None):
        ticket = self.get_object()
        asset_id = request.data.get("asset_id")
        asset_description = request.data.get("asset_description", "")

        asset = None
        if asset_id:
            try:
                asset = Asset.objects.get(pk=asset_id)
            except Asset.DoesNotExist:
                return Response({"detail": "Asset not found."}, status=status.HTTP_404_NOT_FOUND)

        ta = TicketAsset.objects.create(
            ticket=ticket,
            asset=asset,
            asset_description=asset_description,
        )
        return Response(TicketAssetSerializer(ta).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"remove-asset/(?P<ta_id>[^/.]+)")
    def remove_asset(self, request, pk=None, ta_id=None):
        ticket = self.get_object()
        try:
            ta = TicketAsset.objects.get(pk=ta_id, ticket=ticket)
        except TicketAsset.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ta.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["patch"], url_path=r"update-asset/(?P<ta_id>[^/.]+)")
    def update_asset_codes(self, request, pk=None, ta_id=None):
        ticket = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            ta = TicketAsset.objects.get(pk=ta_id, ticket=ticket)
        except TicketAsset.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if "symptom_code" in request.data:
            ta.symptom_code = request.data["symptom_code"]
        if "resolution_code" in request.data:
            ta.resolution_code = request.data["resolution_code"]
        ta.save()
        return Response(TicketAssetSerializer(ta).data)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        ticket = self.get_object()

        if ticket.status == TicketStatus.CLOSED:
            return Response(
                {"detail": "Ticket is already closed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CloseTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        part_objects = {}
        for pu_input in data.get("parts_used", []):
            try:
                part = Part.objects.get(pk=pu_input["part_id"])
            except Part.DoesNotExist:
                return Response(
                    {"detail": f"Part {pu_input['part_id']} not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if part.quantity_on_hand < pu_input["quantity"]:
                return Response(
                    {
                        "detail": (
                            f"Insufficient stock for '{part.name}'. "
                            f"Available: {part.quantity_on_hand}, "
                            f"requested: {pu_input['quantity']}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            part_objects[str(pu_input["part_id"])] = part

        # Auto-calculate labor cost from time entries if not provided
        if data.get("labor_cost") is None:
            pricing = PricingConfig.objects.first() or PricingConfig()
            entries = TimeEntry.objects.filter(ticket=ticket, clocked_out_at__isnull=False)
            total_minutes = sum(e.total_minutes or 0 for e in entries)
            hours = max(float(pricing.min_hours), total_minutes / 60.0)
            labor_cost_val = float(pricing.trip_charge) + hours * float(pricing.hourly_rate)
        else:
            labor_cost_val = data["labor_cost"]

        with transaction.atomic():
            service_report = ServiceReport.objects.create(
                ticket=ticket,
                submitted_by=request.user,
                resolution_code=data["resolution_code"],
                labor_cost=labor_cost_val,
                invoice_email=data.get("invoice_email", ""),
                tech_notes=data.get("tech_notes", ""),
                formatted_report=data.get("formatted_report", ""),
            )

            for pu_input in data.get("parts_used", []):
                part = part_objects[str(pu_input["part_id"])]
                PartUsed.objects.create(
                    service_report=service_report,
                    part=part,
                    quantity=pu_input["quantity"],
                    unit_price_at_time=part.selling_price,
                )
                part.quantity_on_hand -= pu_input["quantity"]
                part.save(update_fields=["quantity_on_hand", "updated_at"])

            for pn_input in data.get("parts_needed", []):
                pr_kwargs = {
                    "ticket": ticket,
                    "quantity_needed": pn_input.get("quantity_needed", 1),
                    "urgency": pn_input.get("urgency", "NEXT_VISIT"),
                    "notes": pn_input.get("notes", ""),
                }
                if pn_input.get("part_id"):
                    try:
                        part_obj = Part.objects.get(pk=pn_input["part_id"])
                        pr_kwargs["part"] = part_obj
                    except Part.DoesNotExist:
                        pass
                else:
                    pr_kwargs.update({
                        "part_name": pn_input.get("part_name", ""),
                        "sku": pn_input.get("sku", ""),
                        "asset_category": pn_input.get("asset_category", ""),
                        "make": pn_input.get("make", ""),
                        "model_number": pn_input.get("model_number", ""),
                        "vendor": pn_input.get("vendor", ""),
                        "cost_price": pn_input.get("cost_price"),
                        "selling_price": pn_input.get("selling_price"),
                    })
                PartRequest.objects.create(**pr_kwargs)

            ticket.status = TicketStatus.CLOSED
            ticket.closed_at = timezone.now()
            ticket.save(update_fields=["status", "closed_at", "updated_at"])

            if ticket.asset:
                ticket.asset.status = AssetStatus.OPERATIONAL
                ticket.asset.save(update_fields=["status", "updated_at"])

        service_report = (
            ServiceReport.objects
            .prefetch_related("parts_used__part")
            .select_related("ticket__asset__store__organization", "ticket__assigned_tech")
            .get(pk=service_report.pk)
        )

        pdf_bytes = generate_invoice_pdf(service_report)

        invoice_email = data.get("invoice_email", "")
        if invoice_email:
            sent = send_invoice_email(invoice_email, service_report, pdf_bytes)
            service_report.invoice_sent = sent
            service_report.save(update_fields=["invoice_sent"])

        return Response(
            ServiceReportSerializer(service_report).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="save-progress")
    def save_progress(self, request, pk=None):
        ticket = self.get_object()

        if ticket.status in (TicketStatus.CLOSED, TicketStatus.COMPLETED):
            return Response(
                {"detail": "Cannot save progress on a completed or closed ticket."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SaveProgressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Auto-calculate labor if not provided
        if data.get("labor_cost") is None:
            pricing = PricingConfig.objects.first() or PricingConfig()
            entries = TimeEntry.objects.filter(ticket=ticket, clocked_out_at__isnull=False)
            total_minutes = sum(e.total_minutes or 0 for e in entries)
            hours = max(float(pricing.min_hours), total_minutes / 60.0)
            labor_cost_val = float(pricing.trip_charge) + hours * float(pricing.hourly_rate)
        else:
            labor_cost_val = data["labor_cost"]

        # Draft parts as JSON (no inventory deduction yet)
        draft_parts = [
            {"part_id": str(pu["part_id"]), "quantity": pu["quantity"]}
            for pu in data.get("parts_used", [])
        ]

        with transaction.atomic():
            # Create or update service report
            report, _ = ServiceReport.objects.update_or_create(
                ticket=ticket,
                defaults={
                    "submitted_by": request.user,
                    "resolution_code": data["resolution_code"],
                    "labor_cost": labor_cost_val,
                    "tech_notes": data.get("tech_notes", ""),
                    "formatted_report": data.get("formatted_report", ""),
                    "draft_parts": draft_parts,
                },
            )

            # Create part requests (idempotent-ish — may create duplicates if called multiple times)
            for pn_input in data.get("parts_needed", []):
                pr_kwargs = {
                    "ticket": ticket,
                    "quantity_needed": pn_input.get("quantity_needed", 1),
                    "urgency": pn_input.get("urgency", "NEXT_VISIT"),
                    "notes": pn_input.get("notes", ""),
                }
                if pn_input.get("part_id"):
                    try:
                        part_obj = Part.objects.get(pk=pn_input["part_id"])
                        pr_kwargs["part"] = part_obj
                    except Part.DoesNotExist:
                        pass
                else:
                    pr_kwargs.update({
                        "part_name": pn_input.get("part_name", ""),
                        "sku": pn_input.get("sku", ""),
                        "asset_category": pn_input.get("asset_category", ""),
                        "make": pn_input.get("make", ""),
                        "model_number": pn_input.get("model_number", ""),
                        "vendor": pn_input.get("vendor", ""),
                        "cost_price": pn_input.get("cost_price"),
                        "selling_price": pn_input.get("selling_price"),
                    })
                PartRequest.objects.create(**pr_kwargs)

            # Move ticket to IN_PROGRESS if still at DISPATCHED
            if ticket.status == TicketStatus.DISPATCHED:
                ticket.status = TicketStatus.IN_PROGRESS
                ticket.save(update_fields=["status", "updated_at"])

        return Response(ServiceReportSerializer(report).data)

    @action(detail=True, methods=["post"], url_path="mark-complete")
    def mark_complete(self, request, pk=None):
        ticket = self.get_object()

        if ticket.status == TicketStatus.CLOSED:
            return Response({"detail": "Ticket is already closed."}, status=status.HTTP_400_BAD_REQUEST)
        if ticket.status == TicketStatus.COMPLETED:
            return Response({"detail": "Ticket is already marked complete."}, status=status.HTTP_400_BAD_REQUEST)

        # Clock out tech if still clocked in
        active_entry = TimeEntry.objects.filter(ticket=ticket, clocked_out_at__isnull=True).first()
        if active_entry:
            now = timezone.now()
            active_entry.clocked_out_at = now
            delta = now - active_entry.clocked_in_at
            active_entry.total_minutes = int(delta.total_seconds() / 60)
            active_entry.save(update_fields=["clocked_out_at", "total_minutes"])

        ticket.status = TicketStatus.COMPLETED
        ticket.save(update_fields=["status", "updated_at"])

        return Response(TicketSerializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="generate-invoice")
    def generate_invoice(self, request, pk=None):
        ticket = self.get_object()

        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Only ORS Admin can generate invoices."}, status=status.HTTP_403_FORBIDDEN)

        if ticket.status == TicketStatus.CLOSED:
            return Response({"detail": "Ticket is already closed."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = GenerateInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        parts_input = data.get("parts_used", [])

        # Validate stock
        part_objects = {}
        for pu_input in parts_input:
            try:
                part = Part.objects.get(pk=pu_input["part_id"])
            except Part.DoesNotExist:
                return Response({"detail": f"Part {pu_input['part_id']} not found."}, status=status.HTTP_404_NOT_FOUND)
            if part.quantity_on_hand < pu_input["quantity"]:
                return Response(
                    {"detail": f"Insufficient stock for '{part.name}'. Available: {part.quantity_on_hand}, requested: {pu_input['quantity']}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            part_objects[str(pu_input["part_id"])] = part

        # Auto-calculate labor if not provided
        if data.get("labor_cost") is None:
            pricing = PricingConfig.objects.first() or PricingConfig()
            entries = TimeEntry.objects.filter(ticket=ticket, clocked_out_at__isnull=False)
            total_minutes = sum(e.total_minutes or 0 for e in entries)
            hours = max(float(pricing.min_hours), total_minutes / 60.0)
            labor_cost_val = float(pricing.trip_charge) + hours * float(pricing.hourly_rate)
        else:
            labor_cost_val = data["labor_cost"]

        # Use pricing config tax_rate as default if not specified
        if data.get("tax_rate") is None:
            pricing = PricingConfig.objects.first()
            tax_rate_val = float(pricing.tax_rate) if pricing else 0
        else:
            tax_rate_val = float(data["tax_rate"])

        with transaction.atomic():
            # Get or create service report
            report, _ = ServiceReport.objects.get_or_create(
                ticket=ticket,
                defaults={
                    "submitted_by": request.user,
                    "resolution_code": data["resolution_code"],
                    "labor_cost": labor_cost_val,
                    "invoice_email": data.get("invoice_email", ""),
                    "tech_notes": data.get("tech_notes", ""),
                    "formatted_report": data.get("formatted_report", ""),
                    "tax_rate": tax_rate_val,
                },
            )
            # Update with latest values
            report.resolution_code = data["resolution_code"]
            report.labor_cost = labor_cost_val
            report.invoice_email = data.get("invoice_email", "")
            report.tech_notes = data.get("tech_notes", "")
            report.formatted_report = data.get("formatted_report", "")
            report.tax_rate = tax_rate_val
            report.draft_parts = []
            report.save()

            # Remove any existing PartUsed records (replace with final list)
            report.parts_used.all().delete()

            # Create PartUsed and deduct inventory
            for pu_input in parts_input:
                part = part_objects[str(pu_input["part_id"])]
                PartUsed.objects.create(
                    service_report=report,
                    part=part,
                    quantity=pu_input["quantity"],
                    unit_price_at_time=part.selling_price,
                )
                part.quantity_on_hand -= pu_input["quantity"]
                part.save(update_fields=["quantity_on_hand", "updated_at"])

            # Close ticket
            ticket.status = TicketStatus.CLOSED
            ticket.closed_at = timezone.now()
            ticket.save(update_fields=["status", "closed_at", "updated_at"])

            # Update asset status
            for ta in ticket.ticket_assets.select_related("asset"):
                if ta.asset:
                    ta.asset.status = AssetStatus.OPERATIONAL
                    ta.asset.save(update_fields=["status", "updated_at"])

        # Generate and optionally send PDF
        try:
            pdf_bytes = generate_invoice_pdf(report)
            email = data.get("invoice_email", "")
            if email:
                send_invoice_email(email, report, pdf_bytes)
                report.invoice_sent = True
                report.save(update_fields=["invoice_sent"])
        except Exception:
            pass

        return Response(ServiceReportSerializer(report).data)


# ── Part Requests ─────────────────────────────────────────────────────────────

class PartRequestViewSet(viewsets.ModelViewSet):
    serializer_class = PartRequestSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = PartRequest.objects.select_related(
            "ticket__store", "part", "ticket"
        ).prefetch_related("ticket__ticket_assets__asset")
        user = self.request.user
        profile = getattr(user, "profile", None)
        if profile and profile.role == UserRole.ORS_ADMIN:
            pass
        elif profile and profile.role == UserRole.CLIENT_ADMIN:
            org = profile.organization
            qs = qs.filter(
                ticket__store__organization=org,
                status__in=[
                    PartRequestStatus.SENT_TO_CLIENT,
                    PartRequestStatus.APPROVED_CLIENT,
                    PartRequestStatus.DENIED,
                    PartRequestStatus.ORDERED,
                    PartRequestStatus.DELIVERED,
                ],
            )
        elif profile and profile.role == UserRole.TECH:
            qs = qs.filter(ticket__assigned_tech=user)
        else:
            qs = qs.none()

        ticket_id = self.request.query_params.get("ticket")
        if ticket_id:
            qs = qs.filter(ticket_id=ticket_id)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=["post"], url_path="approve-ors")
    def approve_ors(self, request, pk=None):
        pr = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        pr.status = PartRequestStatus.APPROVED_ORS
        pr.approved_by_ors_at = timezone.now()
        pr.save(update_fields=["status", "approved_by_ors_at", "updated_at"])
        return Response(PartRequestSerializer(pr).data)

    @action(detail=True, methods=["post"], url_path="send-to-client")
    def send_to_client(self, request, pk=None):
        pr = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        pr.status = PartRequestStatus.SENT_TO_CLIENT
        pr.save(update_fields=["status", "updated_at"])
        return Response(PartRequestSerializer(pr).data)

    @action(detail=True, methods=["post"], url_path="approve-client")
    def approve_client(self, request, pk=None):
        pr = self.get_object()
        role = getattr(request.user.profile, "role", None)
        if role not in [UserRole.ORS_ADMIN, UserRole.CLIENT_ADMIN]:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        pr.status = PartRequestStatus.APPROVED_CLIENT
        pr.approved_by_client_at = timezone.now()
        pr.save(update_fields=["status", "approved_by_client_at", "updated_at"])
        return Response(PartRequestSerializer(pr).data)

    @action(detail=True, methods=["post"], url_path="deny")
    def deny(self, request, pk=None):
        pr = self.get_object()
        role = getattr(request.user.profile, "role", None)
        if role not in [UserRole.ORS_ADMIN, UserRole.CLIENT_ADMIN]:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        pr.status = PartRequestStatus.DENIED
        pr.save(update_fields=["status", "updated_at"])
        return Response(PartRequestSerializer(pr).data)

    @action(detail=True, methods=["post"], url_path="mark-ordered")
    def mark_ordered(self, request, pk=None):
        pr = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        pr.status = PartRequestStatus.ORDERED
        pr.tracking_number = request.data.get("tracking_number", "")
        pr.ordered_at = timezone.now()
        pr.save(update_fields=["status", "tracking_number", "ordered_at", "updated_at"])
        return Response(PartRequestSerializer(pr).data)

    @action(detail=True, methods=["post"], url_path="mark-delivered")
    def mark_delivered(self, request, pk=None):
        pr = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        pr.status = PartRequestStatus.DELIVERED
        pr.delivered_at = timezone.now()
        pr.save(update_fields=["status", "delivered_at", "updated_at"])
        return Response(PartRequestSerializer(pr).data)

    @action(detail=True, methods=["post"], url_path="generate-followup")
    def generate_followup(self, request, pk=None):
        pr = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if pr.status != PartRequestStatus.DELIVERED:
            return Response({"detail": "Parts must be delivered first."}, status=status.HTTP_400_BAD_REQUEST)
        orig = pr.ticket
        new_ticket = Ticket.objects.create(
            store=orig.store,
            asset=orig.asset,
            asset_description=orig.asset_description,
            description=f"Follow-up: parts delivered for original ticket. Part: {pr.part.name if pr.part else pr.part_name}",
            priority=orig.priority,
            status=TicketStatus.OPEN,
            opened_by=request.user,
        )
        for ta in orig.ticket_assets.all():
            TicketAsset.objects.create(
                ticket=new_ticket,
                asset=ta.asset,
                asset_description=ta.asset_description,
            )
        return Response(TicketSerializer(new_ticket).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path="update-part-details")
    def update_part_details(self, request, pk=None):
        pr = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        fields = ["part_name", "sku", "asset_category", "make", "model_number", "vendor", "cost_price", "selling_price"]
        for field in fields:
            if field in request.data:
                setattr(pr, field, request.data[field])
        pr.save()

        if request.data.get("promote_to_inventory"):
            new_part = Part.objects.create(
                name=pr.part_name,
                sku=pr.sku,
                asset_category=pr.asset_category or "OTHER",
                make=pr.make,
                model_number=pr.model_number,
                vendor=pr.vendor,
                unit_price=pr.cost_price or 0,
                selling_price=pr.selling_price or 0,
                quantity_on_hand=0,
            )
            pr.part = new_part
            pr.save(update_fields=["part"])

        return Response(PartRequestSerializer(pr).data)


# ── Service Reports ───────────────────────────────────────────────────────────

class ServiceReportViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceReportSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "profile") and user.profile.role == UserRole.ORS_ADMIN:
            return (
                ServiceReport.objects
                .prefetch_related("parts_used__part")
                .select_related("ticket__asset__store__organization")
                .all()
            )
        elif hasattr(user, "profile") and user.profile.organization:
            return (
                ServiceReport.objects
                .filter(ticket__asset__store__organization=user.profile.organization)
                .prefetch_related("parts_used__part")
                .select_related("ticket__asset__store__organization")
            )
        return ServiceReport.objects.none()

    def partial_update(self, request, *args, **kwargs):
        report = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        allowed = ["resolution_code", "labor_cost", "tech_notes", "formatted_report", "tax_rate", "invoice_email", "draft_parts"]
        data = {k: v for k, v in request.data.items() if k in allowed}
        serializer = self.get_serializer(report, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ── KPIs ──────────────────────────────────────────────────────────────────────

class KPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)

        # Base querysets scoped by role
        if profile and profile.role == UserRole.ORS_ADMIN:
            tickets = Ticket.objects.all()
            reports = ServiceReport.objects.all()
            parts   = Part.objects.all()
        elif profile and profile.organization:
            org = profile.organization
            tickets = Ticket.objects.filter(asset__store__organization=org)
            reports = ServiceReport.objects.filter(ticket__asset__store__organization=org)
            parts   = Part.objects.all()
        else:
            tickets = Ticket.objects.none()
            reports = ServiceReport.objects.none()
            parts   = Part.objects.none()

        # ── Ticket counts by status ────────────────────────────────────────────
        status_counts = {s: 0 for s in ["OPEN", "IN_PROGRESS", "PENDING_PARTS", "RESOLVED", "CLOSED", "CANCELLED"]}
        for row in tickets.values("status").annotate(n=Count("id")):
            status_counts[row["status"]] = row["n"]

        # ── Avg resolution time (hours) for closed tickets ────────────────────
        closed_qs = tickets.filter(status=TicketStatus.CLOSED, closed_at__isnull=False)
        avg_hours = None
        if closed_qs.exists():
            from django.db.models import ExpressionWrapper, DurationField
            delta_qs = closed_qs.annotate(
                delta=ExpressionWrapper(F("closed_at") - F("created_at"), output_field=DurationField())
            ).aggregate(avg=Avg("delta"))
            if delta_qs["avg"]:
                avg_hours = round(delta_qs["avg"].total_seconds() / 3600, 1)

        # ── Revenue (closed service reports) ──────────────────────────────────
        labor_total = reports.aggregate(t=Sum("labor_cost"))["t"] or 0
        parts_total = PartUsed.objects.filter(
            service_report__in=reports
        ).aggregate(t=Sum(F("quantity") * F("unit_price_at_time")))["t"] or 0
        total_revenue = float(labor_total) + float(parts_total)

        # ── Top symptom codes ──────────────────────────────────────────────────
        top_symptoms = list(
            tickets.values("symptom_code")
            .annotate(count=Count("id"))
            .order_by("-count")[:6]
        )

        # ── Top resolution codes ───────────────────────────────────────────────
        top_resolutions = list(
            reports.values("resolution_code")
            .annotate(count=Count("id"))
            .order_by("-count")[:6]
        )

        # ── Top assets by ticket volume ────────────────────────────────────────
        top_assets = list(
            tickets.values(
                asset_name=F("asset__name"),
                store_name=F("asset__store__name"),
            )
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )

        # ── Monthly ticket trend (last 6 months) ──────────────────────────────
        six_months_ago = timezone.now().replace(day=1) - timezone.timedelta(days=180)
        monthly = list(
            tickets.filter(created_at__gte=six_months_ago)
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )

        # ── Low stock ─────────────────────────────────────────────────────────
        low_stock_count = sum(1 for p in parts if p.is_low_stock)

        return Response({
            "tickets": {**status_counts, "total": sum(status_counts.values())},

            "avg_resolution_hours": avg_hours,
            "total_revenue": round(total_revenue, 2),
            "low_stock_count": low_stock_count,
            "top_symptoms":    top_symptoms,
            "top_resolutions": top_resolutions,
            "top_assets":      top_assets,
            "monthly_trend":   [
                {"month": row["month"].strftime("%b %Y"), "count": row["count"]}
                for row in monthly
            ],
        })


# ── Pricing Config ────────────────────────────────────────────────────────────

class PricingConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_config(self):
        config = PricingConfig.objects.first()
        if config is None:
            config = PricingConfig.objects.create()
        return config

    def get(self, request):
        return Response(PricingConfigSerializer(self._get_config()).data)

    def patch(self, request):
        profile = getattr(request.user, "profile", None)
        if not profile or profile.role != UserRole.ORS_ADMIN:
            return Response({"detail": "ORS Admin only."}, status=status.HTTP_403_FORBIDDEN)
        config = self._get_config()
        ser = PricingConfigSerializer(config, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


# ── Time Tracking ─────────────────────────────────────────────────────────────

class TimeEntryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ticket_id = request.query_params.get("ticket_id")
        if not ticket_id:
            return Response({"detail": "ticket_id required."}, status=status.HTTP_400_BAD_REQUEST)

        active = TimeEntry.objects.filter(
            tech=request.user, ticket_id=ticket_id, clocked_out_at__isnull=True
        ).first()

        completed = TimeEntry.objects.filter(
            tech=request.user, ticket_id=ticket_id, clocked_out_at__isnull=False
        )
        total_minutes = sum(e.total_minutes or 0 for e in completed)

        pricing = PricingConfig.objects.first() or PricingConfig()
        hours = max(float(pricing.min_hours), total_minutes / 60.0)
        estimated_labor = round(float(pricing.trip_charge) + hours * float(pricing.hourly_rate), 2)

        return Response({
            "active_entry": TimeEntrySerializer(active).data if active else None,
            "total_minutes": total_minutes,
            "is_clocked_in": active is not None,
            "estimated_labor": estimated_labor,
            "pricing": PricingConfigSerializer(pricing).data,
        })

    def post(self, request):
        action_type = request.data.get("action")
        ticket_id   = request.data.get("ticket_id")

        if not ticket_id:
            return Response({"detail": "ticket_id required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ticket = Ticket.objects.get(pk=ticket_id)
        except Ticket.DoesNotExist:
            return Response({"detail": "Ticket not found."}, status=status.HTTP_404_NOT_FOUND)

        if action_type == "clock_in":
            if TimeEntry.objects.filter(tech=request.user, ticket=ticket, clocked_out_at__isnull=True).exists():
                return Response({"detail": "Already clocked in."}, status=status.HTTP_400_BAD_REQUEST)
            entry = TimeEntry.objects.create(
                tech=request.user, ticket=ticket, clocked_in_at=timezone.now()
            )
            if ticket.status == TicketStatus.DISPATCHED:
                ticket.status = TicketStatus.IN_PROGRESS
                ticket.save(update_fields=["status", "updated_at"])
            return Response(TimeEntrySerializer(entry).data, status=status.HTTP_201_CREATED)

        if action_type == "clock_out":
            entry = TimeEntry.objects.filter(
                tech=request.user, ticket=ticket, clocked_out_at__isnull=True
            ).first()
            if not entry:
                return Response({"detail": "Not clocked in."}, status=status.HTTP_400_BAD_REQUEST)
            now = timezone.now()
            entry.clocked_out_at = now
            entry.total_minutes  = max(1, int((now - entry.clocked_in_at).total_seconds() / 60))
            entry.save(update_fields=["clocked_out_at", "total_minutes"])
            return Response(TimeEntrySerializer(entry).data)

        return Response({"detail": "action must be clock_in or clock_out."}, status=status.HTTP_400_BAD_REQUEST)


# ── Work Images ───────────────────────────────────────────────────────────────

class WorkImageView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser]

    def get(self, request):
        ticket_id = request.query_params.get("ticket_id")
        if not ticket_id:
            return Response([])
        images = WorkImage.objects.filter(ticket_id=ticket_id)
        return Response(WorkImageSerializer(images, many=True).data)

    def post(self, request):
        from decouple import config as env
        ticket_id   = request.data.get("ticket_id")
        image_file  = request.FILES.get("image")

        if not ticket_id or not image_file:
            return Response({"detail": "ticket_id and image are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ticket = Ticket.objects.get(pk=ticket_id)
        except Ticket.DoesNotExist:
            return Response({"detail": "Ticket not found."}, status=status.HTTP_404_NOT_FOUND)

        supabase_url = env("SUPABASE_URL", default="")
        service_key  = env("SUPABASE_SERVICE_KEY", default="")

        if not supabase_url or not service_key:
            return Response({"detail": "Image storage not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        ext  = image_file.name.rsplit(".", 1)[-1].lower() if "." in image_file.name else "jpg"
        path = f"{ticket_id}/{uuid_module.uuid4()}.{ext}"

        upload_resp = http_requests.post(
            f"{supabase_url}/storage/v1/object/work-images/{path}",
            data=image_file.read(),
            headers={
                "Authorization": f"Bearer {service_key}",
                "Content-Type": image_file.content_type or "image/jpeg",
            },
        )

        if upload_resp.status_code not in (200, 201):
            return Response({"detail": "Upload failed. Check Supabase storage config."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        public_url = f"{supabase_url}/storage/v1/object/public/work-images/{path}"
        image = WorkImage.objects.create(ticket=ticket, uploaded_by=request.user, url=public_url)
        return Response(WorkImageSerializer(image).data, status=status.HTTP_201_CREATED)

    def delete(self, request, pk=None):
        try:
            image = WorkImage.objects.get(pk=pk, uploaded_by=request.user)
        except WorkImage.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── AI Report Formatter ───────────────────────────────────────────────────────

class FormatReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from decouple import config as env
        notes = request.data.get("notes", "").strip()
        if not notes:
            return Response({"detail": "notes required."}, status=status.HTTP_400_BAD_REQUEST)

        api_key = env("ANTHROPIC_API_KEY", default="")
        if not api_key:
            return Response({"detail": "AI formatting not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": (
                        "You are a professional field service report editor. "
                        "A technician has provided rough notes about repair work they performed. "
                        "Format the report as follows:\n"
                        "1. A bulleted list of all work performed and findings, preserving every technical detail and fact.\n"
                        "2. Followed by a short 2-3 sentence plain-language summary suitable for a client, "
                        "written in a professional but approachable tone.\n"
                        "Do not add any information that is not already present in the notes. "
                        "Return only the formatted report text, no preamble or labels.\n\n"
                        f"Technician notes:\n{notes}"
                    ),
                }],
            )
            return Response({"formatted_report": message.content[0].text})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Historical Import: AI Code Suggester ──────────────────────────────────────

class SuggestCodesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from decouple import config as env
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        api_key = env("ANTHROPIC_API_KEY", default="")
        if not api_key:
            return Response({"detail": "AI not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        rows = request.data.get("rows", [])
        if not rows:
            return Response({"results": []})

        # Load existing codes for context
        existing_symptom_codes = list(
            SymptomCodeEntry.objects.filter(is_active=True).values("code", "label", "make")
        )
        existing_resolution_codes = list(
            ResolutionCodeEntry.objects.filter(is_active=True).values("code", "label", "make")
        )

        symptom_list = "\n".join(
            f"  {c['code']} — {c['label']}" + (f" (make: {c['make']})" if c['make'] else "")
            for c in existing_symptom_codes
        )
        resolution_list = "\n".join(
            f"  {c['code']} — {c['label']}" + (f" (make: {c['make']})" if c['make'] else "")
            for c in existing_resolution_codes
        )

        rows_text = "\n".join(
            f"Row {i}: make={r.get('make','')}, model={r.get('model_number','')}, "
            f"category={r.get('asset_category','')}, "
            f"symptom_desc={r.get('symptom_description','')}, "
            f"resolution_desc={r.get('resolution_description','')}"
            for i, r in enumerate(rows)
        )

        prompt = f"""You are helping map field service repair records to structured codes for an AI training dataset.

EXISTING SYMPTOM CODES:
{symptom_list}

EXISTING RESOLUTION CODES:
{resolution_list}

REPAIR RECORDS TO CLASSIFY:
{rows_text}

For each row, determine the best symptom code and resolution code.
- If a good match exists in the existing codes, use it (use the exact code string).
- If no good match exists, propose a NEW code. New codes should:
  - Be UPPER_SNAKE_CASE
  - Be concise but specific (e.g. ICE_BRIDGE_FAILURE, HARVEST_CYCLE_FAULT)
  - Include the make name if it's manufacturer-specific (e.g. make: "Hoshizaki")
  - Be blank make if it's generic enough to apply to any manufacturer

Respond with a JSON array (no markdown, just raw JSON) with one object per row:
[
  {{
    "row_index": 0,
    "symptom_code": "NOT_COOLING",
    "symptom_is_new": false,
    "symptom_label": "Not Cooling",
    "symptom_make": "",
    "symptom_asset_category": "",
    "resolution_code": "REPLACED_PART",
    "resolution_is_new": false,
    "resolution_label": "Replaced Part (Other)",
    "resolution_make": "",
    "resolution_asset_category": ""
  }}
]

Only output the JSON array, nothing else."""

        try:
            import anthropic
            import json as json_module
            client = anthropic.Anthropic(api_key=api_key)
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            results = json_module.loads(raw.strip())
            return Response({"results": results})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Historical Import: Bulk Ticket Creator ────────────────────────────────────

class BulkImportTicketsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        tickets_data = request.data.get("tickets", [])
        if not tickets_data:
            return Response({"detail": "No tickets provided."}, status=status.HTTP_400_BAD_REQUEST)

        created = 0
        errors = []

        for i, td in enumerate(tickets_data):
            try:
                with transaction.atomic():
                    # Resolve store
                    store = None
                    store_name = td.get("store_name", "").strip()
                    if store_name:
                        store = Store.objects.filter(name__iexact=store_name).first()

                    # Resolve equipment model
                    eq_model = None
                    make = td.get("make", "").strip()
                    model_number = td.get("model_number", "").strip()
                    if make and model_number:
                        eq_model = EquipmentModel.objects.filter(
                            make__iexact=make, model_number__iexact=model_number
                        ).first()

                    # Resolve technician
                    tech = None
                    tech_name = td.get("technician", "").strip()
                    if tech_name:
                        parts = tech_name.split()
                        if len(parts) >= 2:
                            from django.db.models import Q as DjangoQ
                            tech = User.objects.filter(
                                first_name__iexact=parts[0],
                                last_name__iexact=parts[-1]
                            ).first()

                    # Parse date
                    from django.utils.dateparse import parse_date, parse_datetime
                    import datetime as dt_module
                    job_date = None
                    date_str = td.get("date", "")
                    if date_str:
                        job_date = parse_date(str(date_str))

                    # Determine asset category
                    asset_category = td.get("asset_category", "OTHER") or "OTHER"

                    # Create ticket
                    ticket = Ticket.objects.create(
                        store=store,
                        asset_description=f"{make} {model_number}".strip() if (make or model_number) else td.get("asset_name", ""),
                        assigned_tech=tech,
                        symptom_code=td.get("symptom_code", "OTHER"),
                        description=td.get("symptom_description", ""),
                        status=TicketStatus.CLOSED,
                        scheduled_date=job_date,
                        closed_at=timezone.make_aware(
                            dt_module.datetime.combine(job_date, dt_module.time(12, 0))
                        ) if job_date else timezone.now(),
                        opened_by=request.user,
                    )

                    # Create TicketAsset
                    asset = None
                    if eq_model and store:
                        asset = Asset.objects.filter(
                            equipment_model=eq_model, store=store
                        ).first()

                    TicketAsset.objects.create(
                        ticket=ticket,
                        asset=asset,
                        asset_description=f"{make} {model_number}".strip() if not asset else "",
                        symptom_code=td.get("symptom_code", "OTHER"),
                        resolution_code=td.get("resolution_code", "OTHER"),
                    )

                    # Parse labor cost
                    labor_cost = 0
                    try:
                        labor_cost = float(str(td.get("labor_cost", 0) or 0).replace("$", "").replace(",", ""))
                    except (ValueError, TypeError):
                        pass

                    # Create ServiceReport
                    report = ServiceReport.objects.create(
                        ticket=ticket,
                        submitted_by=request.user,
                        resolution_code=td.get("resolution_code", "OTHER"),
                        labor_cost=labor_cost,
                        tech_notes=td.get("tech_notes", ""),
                        formatted_report=td.get("tech_notes", ""),
                        invoice_sent=False,
                    )

                    created += 1

            except Exception as e:
                errors.append(f"Row {i + 1}: {str(e)}")

        return Response({"created": created, "errors": errors})


# ── Client KPIs ───────────────────────────────────────────────────────────────

class ClientKPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import timedelta
        from django.db.models import ExpressionWrapper, DurationField

        profile = getattr(request.user, "profile", None)
        if not profile or not profile.organization:
            return Response({"detail": "No organization."}, status=status.HTTP_403_FORBIDDEN)

        org = profile.organization

        timeframe = request.query_params.get("timeframe", "month")
        now = timezone.now()
        if timeframe == "week":
            since = now - timedelta(days=7)
        elif timeframe == "quarter":
            since = now - timedelta(days=90)
        elif timeframe == "year":
            since = now - timedelta(days=365)
        else:
            since = now - timedelta(days=30)

        store_id = request.query_params.get("store")

        tickets = Ticket.objects.filter(
            asset__store__organization=org,
            created_at__gte=since,
        )
        reports = ServiceReport.objects.filter(
            ticket__asset__store__organization=org,
            created_at__gte=since,
        )

        if store_id:
            tickets = tickets.filter(asset__store_id=store_id)
            reports = reports.filter(ticket__asset__store_id=store_id)

        # Totals
        labor_total = reports.aggregate(t=Sum("labor_cost"))["t"] or 0
        parts_agg = PartUsed.objects.filter(
            service_report__in=reports
        ).aggregate(t=Sum(F("quantity") * F("unit_price_at_time")))
        parts_total = parts_agg["t"] or 0
        total_spend = round(float(labor_total) + float(parts_total), 2)

        # Ticket status counts
        status_counts = {s: 0 for s in ["OPEN", "IN_PROGRESS", "PENDING_PARTS", "RESOLVED", "CLOSED", "CANCELLED"]}
        for row in tickets.values("status").annotate(n=Count("id")):
            status_counts[row["status"]] = row["n"]

        # Avg resolution time
        closed_qs = tickets.filter(status=TicketStatus.CLOSED, closed_at__isnull=False)
        avg_hours = None
        if closed_qs.exists():
            delta_qs = closed_qs.annotate(
                delta=ExpressionWrapper(F("closed_at") - F("created_at"), output_field=DurationField())
            ).aggregate(avg=Avg("delta"))
            if delta_qs["avg"]:
                avg_hours = round(delta_qs["avg"].total_seconds() / 3600, 1)

        # By store
        store_rows = list(
            tickets.values(store_name=F("asset__store__name"), sid=F("asset__store__id"))
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        labor_by_store = {
            str(r["sid"]): float(r["labor"] or 0)
            for r in reports.values(sid=F("ticket__asset__store__id")).annotate(labor=Sum("labor_cost"))
        }
        parts_by_store = {
            str(r["sid"]): float(r["parts"] or 0)
            for r in PartUsed.objects.filter(service_report__in=reports)
            .values(sid=F("service_report__ticket__asset__store__id"))
            .annotate(parts=Sum(F("quantity") * F("unit_price_at_time")))
        }
        by_store = [
            {
                "store_id": str(r["sid"]),
                "store_name": r["store_name"],
                "count": r["count"],
                "spend": round(labor_by_store.get(str(r["sid"]), 0) + parts_by_store.get(str(r["sid"]), 0), 2),
            }
            for r in store_rows
        ]

        # By asset category
        by_category = list(
            tickets.values(category=F("asset__category"))
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # Monthly trend
        monthly = list(
            tickets.annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )

        return Response({
            "total_spend": total_spend,
            "total_repairs": sum(status_counts.values()),
            "avg_resolution_hours": avg_hours,
            "tickets": {**status_counts, "total": sum(status_counts.values())},
            "by_store": by_store,
            "by_category": by_category,
            "monthly_trend": [
                {"month": row["month"].strftime("%b %Y"), "count": row["count"]}
                for row in monthly
            ],
        })


# ── Invoice PDF download ───────────────────────────────────────────────────────

class InvoicePDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            report = (
                ServiceReport.objects
                .prefetch_related("parts_used__part")
                .select_related("ticket__asset__store__organization", "ticket__assigned_tech")
                .get(pk=pk)
            )
        except ServiceReport.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # Scope check — non-ORS users can only see their org's reports
        profile = getattr(request.user, "profile", None)
        if profile and profile.role != UserRole.ORS_ADMIN:
            org = getattr(profile, "organization", None)
            if not org or report.ticket.asset.store.organization != org:
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        pdf_bytes = generate_invoice_pdf(report)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="invoice-{str(report.id)[:8]}.pdf"'
        return response


# ── KnowledgeEntry ─────────────────────────────────────────────────────────────

class KnowledgeEntryViewSet(viewsets.ModelViewSet):
    serializer_class   = KnowledgeEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = KnowledgeEntry.objects.select_related("contributed_by")
        params = self.request.query_params
        if params.get("asset_category"):
            qs = qs.filter(asset_category=params["asset_category"])
        if params.get("symptom_code"):
            qs = qs.filter(symptom_code=params["symptom_code"])
        if params.get("resolution_code"):
            qs = qs.filter(resolution_code=params["resolution_code"])
        if params.get("verified") == "true":
            qs = qs.filter(is_verified=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(contributed_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="verify")
    def verify(self, request, pk=None):
        entry = self.get_object()
        profile = getattr(request.user, "profile", None)
        if not profile or profile.role != UserRole.ORS_ADMIN:
            return Response({"detail": "Only ORS Admin can verify entries."}, status=status.HTTP_403_FORBIDDEN)
        entry.is_verified = True
        entry.save(update_fields=["is_verified"])
        return Response(KnowledgeEntrySerializer(entry).data)


# ── SymptomCodeEntry / ResolutionCodeEntry ─────────────────────────────────────

class SymptomCodeEntryViewSet(viewsets.ModelViewSet):
    serializer_class = SymptomCodeEntrySerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsORSAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = SymptomCodeEntry.objects.filter(is_active=True)
        make = self.request.query_params.get("make")
        asset_category = self.request.query_params.get("asset_category")
        if make:
            qs = qs.filter(Q(make="") | Q(make__iexact=make))
        if asset_category:
            qs = qs.filter(Q(asset_category="") | Q(asset_category=asset_category))
        return qs


class ResolutionCodeEntryViewSet(viewsets.ModelViewSet):
    serializer_class = ResolutionCodeEntrySerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsORSAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = ResolutionCodeEntry.objects.filter(is_active=True)
        make = self.request.query_params.get("make")
        asset_category = self.request.query_params.get("asset_category")
        if make:
            qs = qs.filter(Q(make="") | Q(make__iexact=make))
        if asset_category:
            qs = qs.filter(Q(asset_category="") | Q(asset_category=asset_category))
        return qs
