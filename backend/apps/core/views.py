import logging

from django.conf import settings
from django.contrib.auth.models import User

logger = logging.getLogger(__name__)
from django.db import transaction
from django.db.models import Avg, Count, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView

import uuid as uuid_module

import requests as http_requests
from rest_framework.parsers import MultiPartParser

from .models import (
    Asset, AssetStatus, DistrictManager, EquipmentModel, KnowledgeEntry, Organization, Part,
    PartRequest, PartsApproval, PartsApprovalStatus, PartUsed, PricingConfig, RepairDocument,
    RepairDocumentChunk, RepairImage, ResolutionCodeEntry, ServiceReport, Store,
    Ticket, TicketAsset, TicketStatus, TimeEntry, UserRole, VerifiedAnswer, WorkImage, SymptomCodeEntry,
)
from .permissions import IsClientAdmin, IsClientAdminOrManager, IsORSAdmin
from .serializers import (
    AssetSerializer, AssignTechSerializer, CloseTicketSerializer,
    CreateUserSerializer, DistrictManagerSerializer, EquipmentModelSerializer, GenerateInvoiceSerializer,
    KnowledgeEntrySerializer,
    OrganizationSerializer, PartsApprovalSerializer, PartRequestSerializer, PartSerializer,
    PricingConfigSerializer, RepairDocumentSerializer, RepairImageSerializer, ResolutionCodeEntrySerializer,
    SaveProgressSerializer, ServiceReportSerializer,
    StoreSerializer, SymptomCodeEntrySerializer, TicketAssetSerializer,
    TicketSerializer, TimeEntrySerializer, UserSerializer, VerifiedAnswerSerializer, WorkImageSerializer,
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
            return Organization.objects.annotate(store_count=Count("stores", filter=Q(stores__is_active=True))).all()
        # Other roles see only their own org
        if hasattr(user, "profile") and user.profile.organization:
            return Organization.objects.annotate(store_count=Count("stores", filter=Q(stores__is_active=True))).filter(id=user.profile.organization_id)
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
        _base = Store.objects.select_related("organization", "manager", "district_manager").annotate(
            asset_count=Count("assets", filter=Q(assets__is_active=True))
        )
        if hasattr(user, "profile") and user.profile.role in (UserRole.ORS_ADMIN, UserRole.TECH):
            qs = _base
        elif hasattr(user, "profile") and user.profile.organization:
            qs = _base.filter(organization=user.profile.organization)
        else:
            return Store.objects.none()

        org_id = self.request.query_params.get("organization")
        if org_id:
            qs = qs.filter(organization_id=org_id)

        active_only = self.request.query_params.get("active")
        if active_only == "true":
            qs = qs.filter(is_active=True)

        return qs


# ── DistrictManager ───────────────────────────────────────────────────────────

class DistrictManagerViewSet(viewsets.ModelViewSet):
    serializer_class = DistrictManagerSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsClientAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = DistrictManager.objects.select_related("organization")
        if hasattr(user, "profile") and user.profile.role == UserRole.ORS_ADMIN:
            pass  # see all
        elif hasattr(user, "profile") and user.profile.organization:
            qs = qs.filter(organization=user.profile.organization)
        else:
            return DistrictManager.objects.none()
        org_id = self.request.query_params.get("organization")
        if org_id:
            qs = qs.filter(organization_id=org_id)
        return qs


# ── EquipmentModel ────────────────────────────────────────────────────────────

class EquipmentModelViewSet(viewsets.ModelViewSet):
    serializer_class = EquipmentModelSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsORSAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = EquipmentModel.objects.annotate(instance_count=Count("instances", filter=Q(instances__is_active=True)))
        if self.request.query_params.get("category"):
            qs = qs.filter(category=self.request.query_params["category"])
        return qs


# ── Assets ────────────────────────────────────────────────────────────────────

class AssetPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 500


class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsClientAdmin()]
        return [IsAuthenticated()]

    pagination_class = AssetPagination

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "profile") and user.profile.role == UserRole.ORS_ADMIN:
            qs = Asset.objects.select_related("store__organization", "equipment_model")
        elif hasattr(user, "profile") and user.profile.organization:
            qs = Asset.objects.filter(
                store__organization=user.profile.organization
            ).select_related("store__organization", "equipment_model")
        else:
            return Asset.objects.none()

        store_id = self.request.query_params.get("store")
        if store_id:
            qs = qs.filter(store_id=store_id)

        equipment_model_id = self.request.query_params.get("equipment_model")
        if equipment_model_id:
            qs = qs.filter(equipment_model_id=equipment_model_id)

        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)

        asset_status = self.request.query_params.get("status")
        if asset_status:
            qs = qs.filter(status=asset_status)

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

        tech_filter = self.request.query_params.get("tech")
        if tech_filter and profile.role == UserRole.ORS_ADMIN:
            qs = qs.filter(assigned_tech_id=tech_filter)

        date_filter = self.request.query_params.get("date")
        if date_filter:
            from django.db.models import F
            qs = qs.filter(scheduled_date=date_filter).order_by(
                F("route_order").asc(nulls_last=True), "-created_at"
            )

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
        instance = serializer.save(store=store)
        instance.assign_ticket_number()
        instance.save(update_fields=["ticket_number"])

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
            trip_charge_val = float(pricing.trip_charge)
            labor_cost_val  = hours * float(pricing.hourly_rate)
        else:
            trip_charge_val = 0
            labor_cost_val  = data["labor_cost"]

        with transaction.atomic():
            service_report = ServiceReport.objects.create(
                ticket=ticket,
                submitted_by=request.user,
                resolution_code=data["resolution_code"],
                trip_charge=trip_charge_val,
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

            close_parts_needed = data.get("parts_needed", [])
            if close_parts_needed:
                approval, created = PartsApproval.objects.get_or_create(
                    ticket=ticket,
                    status=PartsApprovalStatus.PENDING,
                    defaults={"created_by": request.user},
                )
                if not created:
                    approval.part_requests.all().delete()
                for pn_input in close_parts_needed:
                    pr_kwargs = {
                        "ticket": ticket,
                        "parts_approval": approval,
                        "quantity_needed": pn_input.get("quantity_needed", 1),
                        "urgency": pn_input.get("urgency", "NEXT_VISIT"),
                        "notes": pn_input.get("notes", ""),
                    }
                    if pn_input.get("part_id"):
                        try:
                            part_obj = Part.objects.get(pk=pn_input["part_id"])
                            pr_kwargs["part"] = part_obj
                            pr_kwargs["selling_price"] = part_obj.selling_price
                            pr_kwargs["cost_price"] = part_obj.unit_price
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

        invoice_email = data.get("invoice_email", "")
        if invoice_email and service_report.ticket.asset:
            try:
                pdf_bytes = generate_invoice_pdf(service_report)
                send_invoice_email(invoice_email, service_report, pdf_bytes)
                service_report.invoice_sent = True
                service_report.save(update_fields=["invoice_sent"])
            except Exception as exc:
                import logging
                logging.getLogger(__name__).error("Invoice email failed on close: %s", exc)

        return Response(
            ServiceReportSerializer(service_report).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="save-progress")
    def save_progress(self, request, pk=None):
        ticket = self.get_object()

        serializer = SaveProgressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Auto-calculate labor if not provided
        if data.get("labor_cost") is None:
            pricing = PricingConfig.objects.first() or PricingConfig()
            entries = TimeEntry.objects.filter(ticket=ticket, clocked_out_at__isnull=False)
            total_minutes = sum(e.total_minutes or 0 for e in entries)
            hours = max(float(pricing.min_hours), total_minutes / 60.0)
            trip_charge_val = float(pricing.trip_charge)
            labor_cost_val  = hours * float(pricing.hourly_rate)
        else:
            trip_charge_val = float(data.get("trip_charge", 0))
            labor_cost_val  = data["labor_cost"]

        # Draft parts as JSON (no inventory deduction yet) — enrich with name/sku/price
        draft_parts = []
        for pu in data.get("parts_used", []):
            entry = {"part_id": str(pu["part_id"]), "quantity": pu["quantity"]}
            try:
                part_obj = Part.objects.get(pk=pu["part_id"])
                entry["part_name"] = part_obj.name
                entry["part_sku"]  = part_obj.sku or ""
                entry["unit_price"] = str(part_obj.selling_price)
            except Part.DoesNotExist:
                pass
            draft_parts.append(entry)

        with transaction.atomic():
            # Create or update service report
            report, _ = ServiceReport.objects.update_or_create(
                ticket=ticket,
                defaults={
                    "submitted_by": request.user,
                    "resolution_code": data["resolution_code"],
                    "trip_charge": trip_charge_val,
                    "labor_cost": labor_cost_val,
                    "tech_notes": data.get("tech_notes", ""),
                    "formatted_report": data.get("formatted_report", ""),
                    "manager_on_site": data.get("manager_on_site", ""),
                    "manager_signature": data.get("manager_signature", ""),
                    "draft_parts": draft_parts,
                },
            )

            # Handle parts needed — create/update PartsApproval group
            parts_needed_data = data.get("parts_needed", [])
            if parts_needed_data:
                # Get or create a PENDING PartsApproval for this ticket
                approval, created = PartsApproval.objects.get_or_create(
                    ticket=ticket,
                    status=PartsApprovalStatus.PENDING,
                    defaults={"created_by": request.user},
                )
                if not created:
                    # Clear existing part requests on this pending approval to replace with new ones
                    approval.part_requests.all().delete()

                for pn_input in parts_needed_data:
                    pr_kwargs = {
                        "ticket": ticket,
                        "parts_approval": approval,
                        "quantity_needed": pn_input.get("quantity_needed", 1),
                        "urgency": pn_input.get("urgency", "NEXT_VISIT"),
                        "notes": pn_input.get("notes", ""),
                    }
                    if pn_input.get("part_id"):
                        try:
                            part_obj = Part.objects.get(pk=pn_input["part_id"])
                            pr_kwargs["part"] = part_obj
                            pr_kwargs["selling_price"] = part_obj.selling_price
                            pr_kwargs["cost_price"] = part_obj.unit_price
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

            # Update ticket status
            has_pending_parts = bool(data.get("parts_needed"))
            if has_pending_parts:
                if ticket.status not in (TicketStatus.CLOSED, TicketStatus.COMPLETED):
                    ticket.status = TicketStatus.PENDING_PARTS
                    ticket.save(update_fields=["status", "updated_at"])
            elif ticket.status == TicketStatus.DISPATCHED:
                ticket.status = TicketStatus.IN_PROGRESS
                ticket.save(update_fields=["status", "updated_at"])

        report = ServiceReport.objects.prefetch_related("parts_used__part").get(pk=report.pk)
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
        ticket.completed_at = timezone.now()
        ticket.save(update_fields=["status", "completed_at", "updated_at"])

        return Response(TicketSerializer(ticket).data)

    @action(detail=False, methods=["post"], url_path="set-route-order")
    def set_route_order(self, request):
        ticket_ids = request.data.get("ticket_ids", [])
        with transaction.atomic():
            for idx, tid in enumerate(ticket_ids):
                Ticket.objects.filter(pk=tid).update(route_order=idx)
        return Response({"detail": "Route order updated."})

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
            trip_charge_val = float(pricing.trip_charge)
            labor_cost_val  = hours * float(pricing.hourly_rate)
        else:
            trip_charge_val = float(data.get("trip_charge", 0))
            labor_cost_val  = data["labor_cost"]

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
                    "trip_charge": trip_charge_val,
                    "labor_cost": labor_cost_val,
                    "invoice_email": data.get("invoice_email", ""),
                    "tech_notes": data.get("tech_notes", ""),
                    "formatted_report": data.get("formatted_report", ""),
                    "tax_rate": tax_rate_val,
                },
            )
            # Update with latest values
            report.resolution_code = data["resolution_code"]
            report.trip_charge = trip_charge_val
            report.labor_cost = labor_cost_val
            report.invoice_email = data.get("invoice_email", "")
            report.tech_notes = data.get("tech_notes", "")
            report.formatted_report = data.get("formatted_report", "")
            report.manager_on_site = data.get("manager_on_site", "")
            report.manager_signature = data.get("manager_signature", "")
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
        ors_settings = PricingConfig.objects.first()
        pdf_bytes = generate_invoice_pdf(report, ors_settings=ors_settings)
        email = data.get("invoice_email", "")
        if email:
            try:
                send_invoice_email(email, report, pdf_bytes, ors_settings=ors_settings)
                report.invoice_sent = True
                report.save(update_fields=["invoice_sent"])
            except Exception as exc:
                import logging
                logging.getLogger(__name__).error("Invoice email failed: %s", exc)
                return Response(
                    {"detail": f"Invoice saved but email failed to send: {exc}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        # Generate embedding for AI retrieval (non-blocking)
        try:
            from .services.embeddings import embed_ticket
            embed_ticket(ticket)
        except Exception:
            pass

        report = ServiceReport.objects.prefetch_related("parts_used__part").get(pk=report.pk)
        return Response(ServiceReportSerializer(report).data)

    @action(detail=True, methods=["post"], url_path="send-invoice")
    def send_invoice(self, request, pk=None):
        from decimal import Decimal
        ticket = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        if ticket.status == TicketStatus.PAID:
            return Response({"detail": "Invoice already paid — cannot re-send."}, status=status.HTTP_400_BAD_REQUEST)

        report = ticket.service_reports.prefetch_related("parts_used__part").order_by("-created_at").first()
        if not report:
            return Response({"detail": "No service report found for this ticket."}, status=status.HTTP_400_BAD_REQUEST)

        store = ticket.store
        org   = store.organization if store else None
        if not org:
            return Response({"detail": "Ticket has no organization."}, status=status.HTTP_400_BAD_REQUEST)

        # ── Apply overrides and save to service report ─────────────────────────
        overrides = request.data.get("overrides", {})
        save_fields = []
        if "trip_charge" in overrides:
            report.trip_charge = Decimal(str(overrides["trip_charge"]))
            save_fields.append("trip_charge")
        if "labor_cost" in overrides:
            report.labor_cost = Decimal(str(overrides["labor_cost"]))
            save_fields.append("labor_cost")
        if "tax_rate" in overrides:
            report.tax_rate = Decimal(str(overrides["tax_rate"]))
            save_fields.append("tax_rate")
        if "tech_notes" in overrides:
            report.tech_notes = overrides["tech_notes"]
            save_fields.append("tech_notes")
        if "formatted_report" in overrides:
            report.formatted_report = overrides["formatted_report"]
            save_fields.append("formatted_report")
        if "extra_line_items" in overrides:
            report.extra_line_items = overrides["extra_line_items"]
            save_fields.append("extra_line_items")
        if save_fields:
            save_fields.append("updated_at")
            report.save(update_fields=save_fields)

        # Update existing parts quantities/prices
        if "parts_used" in overrides:
            for p in overrides["parts_used"]:
                try:
                    pu = report.parts_used.get(id=p["id"])
                    pu.quantity = int(p["quantity"])
                    pu.unit_price_at_time = Decimal(str(p["unit_price"]))
                    pu.save(update_fields=["quantity", "unit_price_at_time"])
                except Exception:
                    pass

        # Add new inventory parts (added on invoice page) — deduct stock but never block
        if "new_inventory_parts" in overrides:
            from .models import Part as PartModel, PartUsed as PartUsedModel
            for p in overrides["new_inventory_parts"]:
                try:
                    part = PartModel.objects.get(id=p["part_id"])
                    unit_price = Decimal(str(p.get("unit_price", part.selling_price)))
                    PartUsedModel.objects.create(
                        service_report=report,
                        part=part,
                        quantity=int(p["quantity"]),
                        unit_price_at_time=unit_price,
                    )
                    part.quantity_on_hand = max(0, part.quantity_on_hand - int(p["quantity"]))
                    part.save(update_fields=["quantity_on_hand", "updated_at"])
                except Exception:
                    pass

        # Clear stale prefetch cache so parts_total sees newly created PartUsed records
        if hasattr(report, '_prefetched_objects_cache'):
            report._prefetched_objects_cache.pop('parts_used', None)

        # ── Build email list ───────────────────────────────────────────────────
        invoice_emails = list(org.invoice_emails or [])
        extra_emails   = request.data.get("extra_emails", [])
        if isinstance(extra_emails, list):
            invoice_emails.extend(e for e in extra_emails if e)
        invoice_emails = list(dict.fromkeys(invoice_emails))

        if not invoice_emails:
            return Response(
                {"detail": "No invoice emails configured. Add them in Organization settings or above."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ors_settings = PricingConfig.objects.first()

        # ── Optional Stripe Checkout ───────────────────────────────────────────
        payment_url       = ""
        stripe_session_id = ""
        stripe_key = getattr(settings, "STRIPE_SECRET_KEY", "")
        if stripe_key:
            try:
                import stripe as _stripe
                _stripe.api_key = stripe_key
                frontend_url = getattr(settings, "FRONTEND_URL", "")
                amount_cents = max(1, int(report.grand_total * 100))
                session = _stripe.checkout.Session.create(
                    payment_method_types=["card"],
                    line_items=[{
                        "price_data": {
                            "currency": "usd",
                            "product_data": {"name": f"Service Invoice — Ticket {ticket.ticket_number or str(ticket.id)[:8]}"},
                            "unit_amount": amount_cents,
                        },
                        "quantity": 1,
                    }],
                    mode="payment",
                    metadata={"service_report_id": str(report.id), "ticket_ids": str(ticket.id)},
                    success_url=f"{frontend_url}/portal/invoices?paid=1" if frontend_url else "https://onerepairsolutions.com",
                    cancel_url=f"{frontend_url}/portal/invoices" if frontend_url else "https://onerepairsolutions.com",
                )
                payment_url       = session.url
                stripe_session_id = session.id
            except Exception as exc:
                logger.warning("Stripe session creation failed: %s", exc)

        # ── Generate PDF & send ────────────────────────────────────────────────
        try:
            pdf_bytes = generate_invoice_pdf(report, ors_settings=ors_settings, payment_url=payment_url)
        except Exception as exc:
            logger.error("PDF generation failed: %s", exc)
            return Response({"detail": f"PDF generation failed: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        work_image_urls = list(
            WorkImage.objects.filter(ticket=ticket).values_list("url", flat=True)
        )

        sent_to = []
        last_error = ""
        for email in invoice_emails:
            try:
                send_invoice_email(
                    email, report, pdf_bytes,
                    payment_url=payment_url,
                    ors_settings=ors_settings,
                    work_image_urls=work_image_urls,
                )
                sent_to.append(email)
            except Exception as exc:
                last_error = str(exc)
                logger.error("Failed to send invoice email to %s: %s", email, exc)

        if not sent_to:
            return Response({"detail": f"Failed to send invoice emails: {last_error}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        report.invoice_sent       = True
        report.stripe_session_id  = stripe_session_id
        report.stripe_payment_url = payment_url
        report.save(update_fields=["invoice_sent", "stripe_session_id", "stripe_payment_url", "updated_at"])

        ticket.status    = TicketStatus.COMPLETED
        ticket.save(update_fields=["status", "updated_at"])

        return Response({
            "sent_to": sent_to,
            "payment_url": payment_url,
            "ticket": TicketSerializer(ticket).data,
        })


# ── Part Requests ─────────────────────────────────────────────────────────────

class PartRequestViewSet(viewsets.ModelViewSet):
    serializer_class = PartRequestSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = PartRequest.objects.select_related("ticket__store", "part", "parts_approval")
        user = self.request.user
        profile = getattr(user, "profile", None)
        if profile and profile.role == UserRole.ORS_ADMIN:
            pass
        elif profile and profile.role == UserRole.TECH:
            qs = qs.filter(ticket__assigned_tech=user)
        else:
            qs = qs.none()
        ticket_id = self.request.query_params.get("ticket")
        if ticket_id:
            qs = qs.filter(ticket_id=ticket_id)
        return qs


# ── Parts Approvals ───────────────────────────────────────────────────────────

class PartsApprovalViewSet(viewsets.ModelViewSet):
    serializer_class = PartsApprovalSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = PartsApproval.objects.select_related(
            "ticket__store__organization", "ticket__asset", "created_by"
        ).prefetch_related(
            "part_requests__part",
            "ticket__ticket_assets__asset",
            "ticket__service_reports",
        )
        user = self.request.user
        profile = getattr(user, "profile", None)
        if profile and profile.role == UserRole.ORS_ADMIN:
            pass
        elif profile and profile.role in [UserRole.CLIENT_ADMIN, UserRole.CLIENT_MANAGER]:
            org = profile.organization
            qs = qs.filter(
                ticket__store__organization=org,
                status__in=[
                    PartsApprovalStatus.SENT_TO_CLIENT,
                    PartsApprovalStatus.APPROVED,
                    PartsApprovalStatus.DENIED,
                    PartsApprovalStatus.ORDERED,
                    PartsApprovalStatus.DELIVERED,
                ],
            )
        else:
            qs = qs.none()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        ticket_id = self.request.query_params.get("ticket")
        if ticket_id:
            qs = qs.filter(ticket_id=ticket_id)
        return qs

    @action(detail=True, methods=["post"], url_path="approve-ors")
    def approve_ors(self, request, pk=None):
        pa = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        pa.status = PartsApprovalStatus.APPROVED
        pa.approved_at = timezone.now()
        pa.save(update_fields=["status", "approved_at", "updated_at"])
        return Response(PartsApprovalSerializer(pa).data)

    @action(detail=True, methods=["post"], url_path="send-to-client")
    def send_to_client(self, request, pk=None):
        pa = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        notes = request.data.get("notes_for_client", pa.notes_for_client)
        pa.status = PartsApprovalStatus.SENT_TO_CLIENT
        pa.notes_for_client = notes
        pa.sent_at = timezone.now()
        pa.save(update_fields=["status", "notes_for_client", "sent_at", "updated_at"])
        return Response(PartsApprovalSerializer(pa).data)

    @action(detail=True, methods=["post"], url_path="approve-client")
    def approve_client(self, request, pk=None):
        pa = self.get_object()
        role = getattr(request.user.profile, "role", None)
        if role not in [UserRole.ORS_ADMIN, UserRole.CLIENT_ADMIN, UserRole.CLIENT_MANAGER]:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        pa.status = PartsApprovalStatus.APPROVED
        pa.approved_at = timezone.now()
        pa.save(update_fields=["status", "approved_at", "updated_at"])
        return Response(PartsApprovalSerializer(pa).data)

    @action(detail=True, methods=["post"], url_path="deny")
    def deny(self, request, pk=None):
        pa = self.get_object()
        role = getattr(request.user.profile, "role", None)
        if role not in [UserRole.ORS_ADMIN, UserRole.CLIENT_ADMIN, UserRole.CLIENT_MANAGER]:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        denied_reason = request.data.get("denied_reason", "")
        pa.status = PartsApprovalStatus.DENIED
        pa.denied_reason = denied_reason
        pa.denied_at = timezone.now()
        pa.save(update_fields=["status", "denied_reason", "denied_at", "updated_at"])
        return Response(PartsApprovalSerializer(pa).data)

    @action(detail=True, methods=["post"], url_path="resubmit")
    def resubmit(self, request, pk=None):
        pa = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        pa.status = PartsApprovalStatus.PENDING
        pa.denied_reason = ""
        pa.denied_at = None
        pa.save(update_fields=["status", "denied_reason", "denied_at", "updated_at"])
        return Response(PartsApprovalSerializer(pa).data)

    @action(detail=True, methods=["post"], url_path="mark-ordered")
    def mark_ordered(self, request, pk=None):
        pa = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        pa.status = PartsApprovalStatus.ORDERED
        pa.tracking_number = request.data.get("tracking_number", "")
        pa.ordered_at = timezone.now()
        pa.save(update_fields=["status", "tracking_number", "ordered_at", "updated_at"])

        # Auto-generate follow-up ticket if one doesn't already exist
        if not pa.followup_ticket_id:
            orig = pa.ticket
            part_names = ", ".join(
                pr.part.name if pr.part else pr.part_name
                for pr in pa.part_requests.all()
            )
            tech_notes = ""
            latest_report = orig.service_reports.order_by("-created_at").first()
            if latest_report and latest_report.tech_notes:
                tech_notes = latest_report.tech_notes

            lines = ["Follow-up: install parts when delivered."]
            lines.append(f"Parts ordered: {part_names}")
            if tech_notes:
                lines.append(f"Tech notes from prior visit: {tech_notes}")

            new_ticket = Ticket.objects.create(
                store=orig.store,
                asset=orig.asset,
                asset_description=orig.asset_description,
                description="\n".join(lines),
                priority=orig.priority,
                status=TicketStatus.OPEN,
                opened_by=request.user,
            )
            new_ticket.assign_ticket_number()
            new_ticket.save(update_fields=["ticket_number"])
            for ta in orig.ticket_assets.all():
                TicketAsset.objects.create(
                    ticket=new_ticket,
                    asset=ta.asset,
                    asset_description=ta.asset_description,
                )
            pa.followup_ticket = new_ticket
            pa.save(update_fields=["followup_ticket", "updated_at"])

        return Response(PartsApprovalSerializer(pa).data)

    @action(detail=True, methods=["post"], url_path="mark-delivered")
    def mark_delivered(self, request, pk=None):
        pa = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        pa.status = PartsApprovalStatus.DELIVERED
        pa.delivered_at = timezone.now()
        pa.save(update_fields=["status", "delivered_at", "updated_at"])
        return Response(PartsApprovalSerializer(pa).data)

    @action(detail=True, methods=["post"], url_path="generate-followup")
    def generate_followup(self, request, pk=None):
        pa = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if pa.status != PartsApprovalStatus.DELIVERED:
            return Response({"detail": "Parts must be delivered first."}, status=status.HTTP_400_BAD_REQUEST)
        orig = pa.ticket
        part_names = ", ".join(
            pr.part.name if pr.part else pr.part_name
            for pr in pa.part_requests.all()
        )
        new_ticket = Ticket.objects.create(
            store=orig.store,
            asset=orig.asset,
            asset_description=orig.asset_description,
            description=f"Follow-up: parts delivered. Parts: {part_names}",
            priority=orig.priority,
            status=TicketStatus.OPEN,
            opened_by=request.user,
        )
        new_ticket.assign_ticket_number()
        new_ticket.save(update_fields=["ticket_number"])
        for ta in orig.ticket_assets.all():
            TicketAsset.objects.create(
                ticket=new_ticket,
                asset=ta.asset,
                asset_description=ta.asset_description,
            )
        pa.followup_ticket = new_ticket
        pa.save(update_fields=["followup_ticket", "updated_at"])
        return Response(PartsApprovalSerializer(pa).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="add-part")
    def add_part(self, request, pk=None):
        pa = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if pa.status != PartsApprovalStatus.PENDING:
            return Response({"detail": "Can only edit parts on a PENDING approval."}, status=status.HTTP_400_BAD_REQUEST)
        data = request.data
        pr_kwargs = {
            "ticket": pa.ticket,
            "parts_approval": pa,
            "quantity_needed": data.get("quantity_needed", 1),
            "urgency": data.get("urgency", "NEXT_VISIT"),
            "notes": data.get("notes", ""),
        }
        if data.get("part_id"):
            try:
                part_obj = Part.objects.get(pk=data["part_id"])
                pr_kwargs["part"] = part_obj
                pr_kwargs["selling_price"] = part_obj.selling_price
                pr_kwargs["cost_price"] = part_obj.unit_price
            except Part.DoesNotExist:
                pass
        else:
            pr_kwargs.update({
                "part_name": data.get("part_name", ""),
                "sku": data.get("sku", ""),
                "asset_category": data.get("asset_category", ""),
                "make": data.get("make", ""),
                "model_number": data.get("model_number", ""),
                "vendor": data.get("vendor", ""),
                "cost_price": data.get("cost_price"),
                "selling_price": data.get("selling_price"),
            })
        PartRequest.objects.create(**pr_kwargs)
        pa.refresh_from_db()
        return Response(PartsApprovalSerializer(pa).data)

    @action(detail=True, methods=["delete"], url_path="remove-part/(?P<pr_pk>[^/.]+)")
    def remove_part(self, request, pk=None, pr_pk=None):
        pa = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if pa.status != PartsApprovalStatus.PENDING:
            return Response({"detail": "Can only edit parts on a PENDING approval."}, status=status.HTTP_400_BAD_REQUEST)
        PartRequest.objects.filter(pk=pr_pk, parts_approval=pa).delete()
        pa.refresh_from_db()
        return Response(PartsApprovalSerializer(pa).data)

    @action(detail=True, methods=["patch"], url_path="update-part/(?P<pr_pk>[^/.]+)")
    def update_part(self, request, pk=None, pr_pk=None):
        pa = self.get_object()
        if getattr(request.user.profile, "role", None) != UserRole.ORS_ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if pa.status != PartsApprovalStatus.PENDING:
            return Response({"detail": "Can only edit parts on a PENDING approval."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            pr = PartRequest.objects.get(pk=pr_pk, parts_approval=pa)
        except PartRequest.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        for field in ["part_name", "sku", "asset_category", "make", "model_number", "vendor", "cost_price", "selling_price", "quantity_needed", "urgency", "notes"]:
            if field in request.data:
                setattr(pr, field, request.data[field])
        pr.save()
        pa.refresh_from_db()
        return Response(PartsApprovalSerializer(pa).data)


# ── Service Reports ───────────────────────────────────────────────────────────

class ServiceReportViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceReportSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        params = self.request.query_params
        if hasattr(user, "profile") and user.profile.role == UserRole.ORS_ADMIN:
            qs = (
                ServiceReport.objects
                .prefetch_related("parts_used__part", "ticket__ticket_assets__asset__store__organization")
                .select_related("ticket__asset__store__organization")
                .order_by("-created_at")
            )
        elif hasattr(user, "profile") and user.profile.organization:
            qs = (
                ServiceReport.objects
                .filter(ticket__asset__store__organization=user.profile.organization)
                .prefetch_related("parts_used__part", "ticket__ticket_assets__asset__store__organization")
                .select_related("ticket__asset__store__organization")
                .order_by("-created_at")
            )
        else:
            return ServiceReport.objects.none()
        if params.get("invoice_sent") == "true":
            qs = qs.filter(invoice_sent=True)
        elif params.get("invoice_sent") == "false":
            qs = qs.filter(invoice_sent=False)
        if params.get("status"):
            qs = qs.filter(ticket__status=params["status"])
        return qs

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

    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request, pk=None):
        """Generate a fresh Stripe Checkout session for a single invoice."""
        import stripe as _stripe
        report = self.get_object()
        ticket = report.ticket

        # Hard guard — never charge a paid ticket
        if ticket.status == TicketStatus.PAID:
            return Response({"detail": "already_paid"}, status=status.HTTP_400_BAD_REQUEST)

        if not report.invoice_sent:
            return Response({"detail": "Invoice has not been sent yet."}, status=status.HTTP_400_BAD_REQUEST)

        stripe_key   = getattr(settings, "STRIPE_SECRET_KEY", "")
        frontend_url = getattr(settings, "FRONTEND_URL", "")
        if not stripe_key:
            return Response({"detail": "Payments not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            _stripe.api_key  = stripe_key
            amount_cents     = max(1, int(report.grand_total * 100))
            invoice_label    = ticket.ticket_number or str(ticket.id)[:8].upper()
            session = _stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": f"Service Invoice — {invoice_label}"},
                        "unit_amount": amount_cents,
                    },
                    "quantity": 1,
                }],
                mode="payment",
                metadata={"ticket_ids": str(ticket.id)},
                success_url=f"{frontend_url}/portal/invoices?paid=1" if frontend_url else "https://onerepairsolutions.com",
                cancel_url=f"{frontend_url}/portal/invoices/{report.id}" if frontend_url else "https://onerepairsolutions.com",
            )
            return Response({"payment_url": session.url})
        except Exception as exc:
            logger.error("Stripe session creation failed: %s", exc)
            return Response({"detail": "Failed to create payment session."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Multi-Invoice Payment ──────────────────────────────────────────────────────

class MultiPayView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Create a single Stripe Checkout session for multiple invoices."""
        import stripe as _stripe

        report_ids = request.data.get("report_ids", [])
        if not report_ids:
            return Response({"detail": "No invoices selected."}, status=status.HTTP_400_BAD_REQUEST)

        profile = getattr(request.user, "profile", None)

        # Fetch and validate reports
        reports = list(
            ServiceReport.objects
            .select_related("ticket")
            .filter(pk__in=report_ids, invoice_sent=True)
            .exclude(ticket__status=TicketStatus.PAID)
        )

        if not reports:
            return Response({"detail": "No payable invoices found."}, status=status.HTTP_400_BAD_REQUEST)

        # Scope check — client users can only pay their own org's invoices
        if profile and profile.role != UserRole.ORS_ADMIN:
            org = getattr(profile, "organization", None)
            for r in reports:
                ticket = r.ticket
                ticket_org = None
                if ticket.asset_id:
                    try:
                        ticket_org = ticket.asset.store.organization
                    except Exception:
                        pass
                if not ticket_org:
                    ta = ticket.ticket_assets.select_related("asset__store__organization").first()
                    if ta and ta.asset_id:
                        try:
                            ticket_org = ta.asset.store.organization
                        except Exception:
                            pass
                if not org or ticket_org != org:
                    return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        stripe_key   = getattr(settings, "STRIPE_SECRET_KEY", "")
        frontend_url = getattr(settings, "FRONTEND_URL", "")
        if not stripe_key:
            return Response({"detail": "Payments not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            _stripe.api_key = stripe_key
            line_items = []
            for r in reports:
                ticket       = r.ticket
                label        = ticket.ticket_number or str(ticket.id)[:8].upper()
                amount_cents = max(1, int(r.grand_total * 100))
                line_items.append({
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": f"Service Invoice — {label}"},
                        "unit_amount": amount_cents,
                    },
                    "quantity": 1,
                })

            ticket_ids_csv = ",".join(str(r.ticket_id) for r in reports)
            session = _stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=line_items,
                mode="payment",
                metadata={"ticket_ids": ticket_ids_csv},
                success_url=f"{frontend_url}/portal/invoices?paid=1" if frontend_url else "https://onerepairsolutions.com",
                cancel_url=f"{frontend_url}/portal/invoices" if frontend_url else "https://onerepairsolutions.com",
            )
            return Response({"payment_url": session.url})
        except Exception as exc:
            logger.error("Multi-pay Stripe session failed: %s", exc)
            return Response({"detail": "Failed to create payment session."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        is_admin = getattr(request.user.profile, "role", None) == UserRole.ORS_ADMIN
        try:
            if is_admin:
                image = WorkImage.objects.get(pk=pk)
            else:
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
            imported_ticket = None
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
                            tech = User.objects.filter(
                                first_name__iexact=parts[0],
                                last_name__iexact=parts[-1]
                            ).first()

                    # Parse date
                    from django.utils.dateparse import parse_date
                    import datetime as dt_module
                    job_date = None
                    date_str = td.get("date", "")
                    if date_str:
                        job_date = parse_date(str(date_str))

                    # Determine asset category
                    asset_category = td.get("asset_category", "OTHER") or "OTHER"

                    # Create ticket
                    imported_ticket = Ticket.objects.create(
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
                        ticket=imported_ticket,
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
                        ticket=imported_ticket,
                        submitted_by=request.user,
                        resolution_code=td.get("resolution_code", "OTHER"),
                        labor_cost=labor_cost,
                        tech_notes=td.get("tech_notes", ""),
                        formatted_report=td.get("tech_notes", ""),
                        invoice_sent=False,
                    )

                    # Resolve parts used by SKU (comma-separated)
                    parts_used_str = td.get("parts_used", "") or ""
                    for sku_raw in parts_used_str.split(","):
                        sku = sku_raw.strip()
                        if not sku:
                            continue
                        part = Part.objects.filter(sku__iexact=sku).first()
                        if part:
                            PartUsed.objects.create(
                                service_report=report,
                                part=part,
                                quantity=1,
                                unit_price_at_time=part.unit_price,
                            )

                    created += 1

            except Exception as e:
                errors.append(f"Row {i + 1}: {str(e)}")
                continue

            # Generate embedding outside the transaction (non-blocking)
            if imported_ticket is not None:
                try:
                    from .services.embeddings import embed_ticket
                    embed_ticket(imported_ticket)
                except Exception:
                    pass

        return Response({"created": created, "errors": errors})


# ── Diagnostic Search (RAG) ───────────────────────────────────────────────────

class DiagnosticSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        description = request.data.get("description", "").strip()
        asset_category = request.data.get("asset_category", "").strip()
        make = request.data.get("make", "").strip()
        model_number = request.data.get("model_number", "").strip()

        if not description:
            return Response({"detail": "description is required."}, status=status.HTTP_400_BAD_REQUEST)

        from .services.embeddings import get_embedding
        from pgvector.django import CosineDistance

        # Use input_type="query" for the search vector — Voyage optimises for retrieval
        query_vec = get_embedding(description, input_type="query")
        if query_vec is None:
            return Response(
                {"detail": "Embedding service unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # ── Closed ticket search ──────────────────────────────────────────────
        ticket_qs = (
            Ticket.objects
            .filter(status=TicketStatus.CLOSED, embedding__isnull=False)
            .prefetch_related("service_reports__parts_used__part")
        )
        ticket_results = (
            ticket_qs
            .annotate(distance=CosineDistance("embedding", query_vec))
            .order_by("distance")[:5]
        )

        tickets_out = []
        for t in ticket_results:
            report = t.service_reports.first()
            parts = []
            if report:
                parts = [
                    {"name": pu.part.name, "sku": pu.part.sku}
                    for pu in report.parts_used.all()
                    if pu.part
                ]
            tickets_out.append({
                "id": str(t.id),
                "asset_description": t.asset_description,
                "description": t.description,
                "resolution_code": report.resolution_code if report else "",
                "tech_notes": report.tech_notes if report else "",
                "parts_used": parts,
                "similarity": round(1 - float(t.distance), 3),
                "closed_at": t.closed_at,
            })

        # ── Knowledge entry search ────────────────────────────────────────────
        knowledge_qs = KnowledgeEntry.objects.filter(embedding__isnull=False)
        if asset_category:
            knowledge_qs = knowledge_qs.filter(asset_category=asset_category)

        knowledge_results = (
            knowledge_qs
            .annotate(distance=CosineDistance("embedding", query_vec))
            .order_by("distance")[:3]
        )

        knowledge_out = []
        for k in knowledge_results:
            knowledge_out.append({
                "id": str(k.id),
                "make": k.make,
                "model_number": k.model_number,
                "asset_category": k.asset_category,
                "cause_summary": k.cause_summary,
                "procedure": k.procedure,
                "parts_commonly_used": k.parts_commonly_used,
                "pro_tips": k.pro_tips,
                "difficulty": k.difficulty,
                "is_verified": k.is_verified,
                "similarity": round(1 - float(k.distance), 3),
            })

        # ── Claude generation layer ───────────────────────────────────────────
        diagnosis = None
        if tickets_out or knowledge_out:
            try:
                import json as _json
                import anthropic as _anthropic
                from django.conf import settings as _settings

                context_parts = []

                equipment_hint = " ".join(filter(None, [make, model_number]))
                if equipment_hint:
                    context_parts.append(f"Equipment: {equipment_hint}")

                if knowledge_out:
                    context_parts.append("\n--- KNOWLEDGE BASE ENTRIES ---")
                    for k in knowledge_out:
                        entry_parts = [f"Equipment: {k['make']} {k['model_number']}".strip()]
                        if k["cause_summary"]:
                            entry_parts.append(f"Cause: {k['cause_summary']}")
                        if k["procedure"]:
                            entry_parts.append(f"Procedure: {k['procedure']}")
                        if k["parts_commonly_used"]:
                            entry_parts.append(f"Common Parts: {k['parts_commonly_used']}")
                        if k["pro_tips"]:
                            entry_parts.append(f"Tips: {k['pro_tips']}")
                        context_parts.append("\n".join(entry_parts))

                if tickets_out:
                    context_parts.append("\n--- SIMILAR PAST REPAIRS ---")
                    for t in tickets_out:
                        t_parts = [f"Equipment: {t['asset_description']}"]
                        if t["description"]:
                            t_parts.append(f"Problem: {t['description']}")
                        if t["tech_notes"]:
                            t_parts.append(f"Notes: {t['tech_notes']}")
                        if t["resolution_code"]:
                            t_parts.append(f"Resolution: {t['resolution_code']}")
                        if t["parts_used"]:
                            names = ", ".join(f"{p['name']} ({p['sku']})" for p in t["parts_used"])
                            t_parts.append(f"Parts Used: {names}")
                        context_parts.append("\n".join(t_parts))

                context = "\n\n".join(context_parts)

                prompt = f"""You are an expert field service technician for commercial equipment repair.

A technician is on-site and has described the issue as:
"{description}"

Based on the context below from past repairs and the knowledge base, provide a practical diagnosis.

{context}

Respond ONLY with a JSON object in exactly this format:
{{
  "likely_cause": "concise explanation of the most probable root cause",
  "recommended_steps": ["step 1", "step 2", "step 3"],
  "parts_to_order": [{{"name": "part name", "sku": "SKU if known else empty string", "reason": "why this part"}}],
  "confidence": "low|medium|high",
  "difficulty": "easy|medium|hard|advanced",
  "caution": "any safety warnings or null"
}}

Be direct and practical. Steps should be actionable field instructions."""

                from decouple import config as _config
                _anthropic_key = _config("ANTHROPIC_API_KEY", default="")
                client = _anthropic.Anthropic(api_key=_anthropic_key)
                msg = client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=600,
                    messages=[{"role": "user", "content": prompt}],
                )
                raw = msg.content[0].text.strip()
                # Strip markdown code fences if present
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                diagnosis = _json.loads(raw.strip())
            except Exception:
                diagnosis = None

        return Response({"diagnosis": diagnosis, "tickets": tickets_out, "knowledge": knowledge_out})


def _annotate_image_terms(reply: str) -> str:
    """Wrap RepairImage title/tag matches in [[...]] so the frontend can make them tappable."""
    import re as _re
    if not reply:
        return reply
    try:
        images = RepairImage.objects.values_list("title", "tags")
        for title, tags in images:
            candidates = [title] + (tags or [])
            for term in candidates:
                if not term or len(term) < 3:
                    continue
                # Skip if already wrapped anywhere in the reply
                if f"[[{term.lower()}]]" in reply.lower():
                    continue
                if _re.search(_re.escape(term), reply, _re.IGNORECASE):
                    reply = _re.sub(
                        r'(?<!\[)(?<!\[\[)\b' + _re.escape(term) + r'\b(?!\])(?!\]\])',
                        f"[[{term}]]",
                        reply,
                        count=1,
                        flags=_re.IGNORECASE,
                    )
                    break  # one wrap per image
    except Exception as e:
        logger.warning("_annotate_image_terms failed: %s", e)
    return reply


# ── Diagnostic Chat (conversational AI) ───────────────────────────────────────

class DiagnosticChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import logging
        import anthropic as _anthropic
        from decouple import config as _config
        from .services.embeddings import get_embedding
        from pgvector.django import CosineDistance

        messages = request.data.get("messages", [])
        ctx = request.data.get("context", {})

        if not messages:
            return Response({"detail": "messages required."}, status=status.HTTP_400_BAD_REQUEST)

        asset_name     = ctx.get("asset_name", "")
        asset_category = ctx.get("asset_category", "")
        make           = ctx.get("make", "")
        model_number   = ctx.get("model_number", "")
        store_name     = ctx.get("store_name", "")

        # Build two queries:
        # 1. Specific — equipment context + latest user message (precise match)
        # 2. Broad — equipment context + last 3 exchanges both sides (captures confirmed facts)
        equipment_context = " ".join(filter(None, [make, model_number, asset_category]))
        latest_user = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"), ""
        )
        recent_all = " ".join(
            m["content"] for m in messages[-6:] if m.get("content")
        )
        specific_query = f"{equipment_context} {latest_user}".strip()
        broad_query    = f"{equipment_context} {recent_all}".strip()

        # Search ORS Verified Answers — use only the raw user message, no equipment context,
        # so bare question embeddings match regardless of what equipment is on the ticket
        verified_answer = None
        qa_vec = get_embedding(latest_user, input_type="query") if latest_user else None
        if qa_vec:
            qa_result = (
                VerifiedAnswer.objects
                .filter(embedding__isnull=False)
                .annotate(distance=CosineDistance("embedding", qa_vec))
                .order_by("distance")
                .first()
            )
            if qa_result:
                dist = float(qa_result.distance)
                logger.info("VerifiedAnswer best match '%s' distance=%.3f", qa_result.question, dist)
                if dist <= 0.55:
                    verified_answer = qa_result

        def search_chunks(query_vec, threshold=0.55):
            results = (
                RepairDocumentChunk.objects
                .select_related("document")
                .filter(embedding__isnull=False)
                .annotate(distance=CosineDistance("embedding", query_vec))
                .order_by("distance")[:6]
            )
            return [(c, float(c.distance)) for c in results if float(c.distance) <= threshold]

        rag_lines = []
        seen_chunk_ids = set()

        specific_vec = get_embedding(specific_query, input_type="query") if specific_query else None
        broad_vec    = get_embedding(broad_query, input_type="query") if broad_query and broad_query != specific_query else None

        for query_vec in filter(None, [specific_vec, broad_vec]):
            ticket_results = (
                Ticket.objects
                .filter(status=TicketStatus.CLOSED, embedding__isnull=False)
                .prefetch_related("service_reports__parts_used__part")
                .annotate(distance=CosineDistance("embedding", query_vec))
                .order_by("distance")[:3]
            )
            for t in ticket_results:
                if float(t.distance) > 0.55:
                    continue
                report = t.service_reports.first()
                line = f"Past repair — {t.asset_description}"
                if t.description:
                    line += f": {t.description}"
                if report and report.tech_notes:
                    line += f" | Notes: {report.tech_notes}"
                if report and report.resolution_code:
                    line += f" | Fixed by: {report.resolution_code.replace('_', ' ').lower()}"
                if report:
                    pnames = [pu.part.name for pu in report.parts_used.all() if pu.part]
                    if pnames:
                        line += f" | Parts: {', '.join(pnames)}"
                if line not in rag_lines:
                    rag_lines.append(line)

            knowledge_qs = KnowledgeEntry.objects.filter(embedding__isnull=False)
            if asset_category:
                knowledge_qs = knowledge_qs.filter(asset_category=asset_category)
            knowledge_results = (
                knowledge_qs
                .annotate(distance=CosineDistance("embedding", query_vec))
                .order_by("distance")[:2]
            )
            for k in knowledge_results:
                if float(k.distance) > 0.55:
                    continue
                line = f"Knowledge — {k.make} {k.model_number}".strip()
                if k.symptom_description:
                    line += f": {k.symptom_description}"
                elif k.cause_summary:
                    line += f": {k.cause_summary}"
                if k.diagnostic_steps:
                    steps = "; ".join(
                        f"Step {i+1}: {s.get('action','')} → {s.get('next_action','')}"
                        for i, s in enumerate(k.diagnostic_steps)
                        if s.get("action")
                    )
                    if steps:
                        line += f" | Steps: {steps}"
                if k.parts_commonly_used:
                    line += f" | Common parts: {k.parts_commonly_used}"
                if line not in rag_lines:
                    rag_lines.append(line)

            for chunk, dist in search_chunks(query_vec):
                if chunk.id in seen_chunk_ids:
                    continue
                seen_chunk_ids.add(chunk.id)
                rag_lines.append(f"Support transcript ({chunk.document.title}): {chunk.content.strip()}")

        equipment_info = " ".join(filter(None, [make, model_number])) or asset_name or "unknown equipment"

        system_prompt = f"""You are an AI repair assistant for One Repair Solutions field service technicians.

Current job:
- Asset: {asset_name or "unknown"}
- Equipment: {equipment_info}
- Category: {asset_category or "unknown"}
- Store: {store_name or "unknown"}

Guidelines:
- If the tech asks a direct question, ANSWER IT using the support documents and knowledge base below — do not respond with another question
- Use what the tech has already told you in this conversation to inform your answer — if they confirmed a symptom, factor it in
- Only ask a clarifying question when you genuinely cannot help without more information
- Never ask more than one question at a time
- Keep responses SHORT — the tech is on their phone in the field
- Be direct and practical, no filler phrases
- When diagnosing, give clear numbered steps and list any parts needed with SKUs if known
- Mention safety cautions when relevant
- When you reference a physical component that a tech might need to visually identify (e.g. a board, relay, sensor, fuse, or connector), wrap its name in double square brackets like [[triac relay board]] so the tech can tap it to see an image"""

        if verified_answer:
            system_prompt += (
                f"\n\n⚠️ ORS VERIFIED ANSWER — repeat this answer verbatim, do not modify or add to it:\n"
                f"Q: {verified_answer.question}\n"
                f"A: {verified_answer.answer}"
            )
        elif rag_lines:
            system_prompt += "\n\nRelevant information from support documents, past repairs, and knowledge base — use this to answer the tech's question:\n" + "\n".join(rag_lines)

        valid_messages = [
            {"role": m["role"], "content": m["content"]}
            for m in messages
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]

        try:
            api_key = _config("ANTHROPIC_API_KEY", default="")
            client = _anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=800,
                system=system_prompt,
                messages=valid_messages,
            )
            reply = response.content[0].text.strip()
            reply = _annotate_image_terms(reply)
            return Response({"reply": reply})
        except Exception as exc:
            logging.getLogger(__name__).error("DiagnosticChat error: %s", exc)
            return Response({"detail": "AI assistant unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


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
            # Support both legacy single-asset and multi-asset tickets
            ticket = report.ticket
            ticket_org = None
            if ticket.asset_id:
                try:
                    ticket_org = ticket.asset.store.organization
                except Exception:
                    pass
            if not ticket_org:
                ta = ticket.ticket_assets.select_related("asset__store__organization").first()
                if ta and ta.asset_id:
                    try:
                        ticket_org = ta.asset.store.organization
                    except Exception:
                        pass
            if not org or ticket_org != org:
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        ors_settings = PricingConfig.objects.first()
        try:
            pdf_bytes = generate_invoice_pdf(report, ors_settings=ors_settings, payment_url=report.stripe_payment_url or "")
        except Exception as exc:
            logger.error("PDF download generation failed for report %s: %s", pk, exc, exc_info=True)
            return Response({"detail": f"PDF generation failed: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="invoice-{str(report.id)[:8]}.pdf"'
        return response


# ── Stripe Webhook ────────────────────────────────────────────────────────────

from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

@method_decorator(csrf_exempt, name="dispatch")
class StripeWebhookView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        import stripe as _stripe
        import json as _json

        webhook_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "")
        stripe_key     = getattr(settings, "STRIPE_SECRET_KEY", "")
        if not stripe_key:
            return HttpResponse(status=400)

        try:
            payload    = request.body
            sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
            _stripe.api_key = stripe_key
            if webhook_secret:
                event = _stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
            else:
                event = _json.loads(payload)
        except Exception as exc:
            logger.warning("Stripe webhook parse error: %s", exc)
            return HttpResponse(status=400)

        try:
            # Support both stripe SDK objects (v8 attribute access) and plain dicts
            if isinstance(event, dict):
                event_type    = event.get("type", "")
                session       = event.get("data", {}).get("object", {})
                metadata      = session.get("metadata") or {}
                ticket_ids_raw = metadata.get("ticket_ids") or metadata.get("ticket_id") or ""
            else:
                event_type    = getattr(event, "type", "")
                session       = event.data.object
                metadata      = getattr(session, "metadata", None) or {}
                if hasattr(metadata, "get"):
                    ticket_ids_raw = metadata.get("ticket_ids") or metadata.get("ticket_id") or ""
                else:
                    ticket_ids_raw = getattr(metadata, "ticket_ids", None) or getattr(metadata, "ticket_id", None) or ""

            if event_type == "checkout.session.completed" and ticket_ids_raw:
                # ticket_ids_raw may be a single UUID or comma-separated list
                ticket_ids = [tid.strip() for tid in str(ticket_ids_raw).split(",") if tid.strip()]
                for ticket_id in ticket_ids:
                    try:
                        t = Ticket.objects.get(pk=ticket_id)
                        if t.status != TicketStatus.PAID:
                            t.status = TicketStatus.PAID
                            t.save(update_fields=["status", "updated_at"])
                            logger.info("Ticket %s marked PAID via Stripe webhook", ticket_id)
                    except Ticket.DoesNotExist:
                        logger.warning("Stripe webhook: ticket %s not found", ticket_id)
        except Exception as exc:
            logger.error("Stripe webhook processing error: %s", exc, exc_info=True)
            return HttpResponse(status=200)

        return HttpResponse(status=200)


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
        entry = serializer.save(contributed_by=self.request.user)
        try:
            from .services.embeddings import embed_knowledge_entry
            embed_knowledge_entry(entry)
        except Exception:
            pass

    def perform_update(self, serializer):
        entry = serializer.save()
        try:
            from .services.embeddings import embed_knowledge_entry
            embed_knowledge_entry(entry)
        except Exception:
            pass

    @action(detail=True, methods=["post"], url_path="verify")
    def verify(self, request, pk=None):
        entry = self.get_object()
        profile = getattr(request.user, "profile", None)
        if not profile or profile.role != UserRole.ORS_ADMIN:
            return Response({"detail": "Only ORS Admin can verify entries."}, status=status.HTTP_403_FORBIDDEN)
        entry.is_verified = True
        entry.save(update_fields=["is_verified"])
        return Response(KnowledgeEntrySerializer(entry).data)


# ── Repair Documents ───────────────────────────────────────────────────────────

class RepairDocumentViewSet(viewsets.ModelViewSet):
    serializer_class   = RepairDocumentSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return RepairDocument.objects.all()

    def perform_create(self, serializer):
        doc = serializer.save(uploaded_by=self.request.user)
        try:
            from .services.embeddings import embed_repair_document
            embed_repair_document(doc)
        except Exception as e:
            logger.error("embed_repair_document failed for %s: %s", doc.title, e)

    @action(detail=False, methods=["post"], url_path="bulk-upload")
    def bulk_upload(self, request):
        documents = request.data.get("documents", [])
        if not documents or not isinstance(documents, list):
            return Response({"detail": "documents list required."}, status=status.HTTP_400_BAD_REQUEST)

        from .services.embeddings import embed_repair_document

        created = []
        errors  = []
        for item in documents:
            title   = (item.get("title") or "Untitled").strip()[:255]
            make    = (item.get("make") or "").strip()[:100]
            content = (item.get("content") or "").strip()
            if not content:
                errors.append(f"{title}: empty content, skipped")
                continue
            doc = RepairDocument.objects.create(
                title=title,
                make=make,
                content=content,
                uploaded_by=request.user,
            )
            try:
                embed_repair_document(doc)
            except Exception as e:
                logger.error("embed_repair_document failed for %s: %s", doc.title, e)
            created.append(RepairDocumentSerializer(doc).data)

        return Response({"created": len(created), "errors": errors, "documents": created},
                        status=status.HTTP_201_CREATED)


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


# ── Verified Answers ───────────────────────────────────────────────────────────

class VerifiedAnswerViewSet(viewsets.ModelViewSet):
    serializer_class   = VerifiedAnswerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = VerifiedAnswer.objects.all()
        category = self.request.query_params.get("asset_category")
        if category:
            qs = qs.filter(asset_category=category)
        return qs

    def perform_create(self, serializer):
        entry = serializer.save(created_by=self.request.user)
        self._embed(entry)

    def perform_update(self, serializer):
        entry = serializer.save()
        self._embed(entry)

    def _embed(self, entry):
        try:
            from .services.embeddings import get_embedding
            aliases = self._generate_aliases(entry.question)
            if aliases != entry.aliases:
                entry.aliases = aliases
                entry.save(update_fields=["aliases"])
            # Embed the canonical question + all aliases together so the vector
            # covers a wider semantic space and matches more query variations
            combined = "\n".join([entry.question] + aliases)
            vec = get_embedding(combined, input_type="document")
            if vec:
                entry.embedding = vec
                entry.save(update_fields=["embedding"])
        except Exception as e:
            logger.error("VerifiedAnswer embedding failed for %s: %s", entry.id, e)

    def _generate_aliases(self, question: str) -> list:
        try:
            api_key = _config("ANTHROPIC_API_KEY", default="")
            if not api_key:
                return []
            client = _anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=200,
                messages=[{
                    "role": "user",
                    "content": (
                        f"Generate 5 alternative short phrasings a field technician might use to ask "
                        f"the same question as: \"{question}\"\n"
                        f"Return only a JSON array of strings, nothing else. Example: [\"phrase 1\", \"phrase 2\"]"
                    ),
                }],
            )
            import json
            text = response.content[0].text.strip()
            aliases = json.loads(text)
            return [a for a in aliases if isinstance(a, str)][:5]
        except Exception as e:
            logger.warning("Alias generation failed for '%s': %s", question, e)
            return []


# ── Repair Images ─────────────────────────────────────────────────────────────

class RepairImageViewSet(viewsets.ModelViewSet):
    serializer_class   = RepairImageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = RepairImage.objects.all()
        make = self.request.query_params.get("make")
        if make:
            qs = qs.filter(make__iexact=make)
        return qs

    @action(detail=False, methods=["post"], url_path="upload", parser_classes=[MultiPartParser])
    def upload(self, request):
        image_file = request.FILES.get("image")
        if not image_file:
            return Response({"detail": "No image file provided."}, status=status.HTTP_400_BAD_REQUEST)

        title          = request.data.get("title", "").strip()
        make           = request.data.get("make", "").strip()
        asset_category = request.data.get("asset_category", "").strip()
        raw_tags       = request.data.get("tags", "")
        tags = [t.strip() for t in raw_tags.split(",") if t.strip()] if raw_tags else []

        if not title:
            return Response({"detail": "title is required."}, status=status.HTTP_400_BAD_REQUEST)

        from decouple import config as env
        supabase_url = env("SUPABASE_URL", default="")
        service_key  = env("SUPABASE_SERVICE_KEY", default="")

        if not supabase_url or not service_key:
            return Response({"detail": "Image storage not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        ext  = image_file.name.rsplit(".", 1)[-1].lower() if "." in image_file.name else "jpg"
        path = f"{uuid_module.uuid4()}.{ext}"

        upload_resp = http_requests.post(
            f"{supabase_url}/storage/v1/object/repair-images/{path}",
            data=image_file.read(),
            headers={
                "Authorization": f"Bearer {service_key}",
                "Content-Type": image_file.content_type or "image/jpeg",
            },
        )

        if upload_resp.status_code not in (200, 201):
            logger.error("Repair image upload failed: %s %s", upload_resp.status_code, upload_resp.text)
            return Response({"detail": "Upload to storage failed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        public_url = f"{supabase_url}/storage/v1/object/public/repair-images/{path}"
        image = RepairImage.objects.create(
            title=title,
            url=public_url,
            tags=tags,
            make=make,
            asset_category=asset_category,
            uploaded_by=request.user,
        )
        return Response(RepairImageSerializer(image).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        q = request.query_params.get("q", "").strip().lower()
        if not q:
            return Response([])
        from django.db.models import Q as DQ
        results = RepairImage.objects.filter(
            DQ(title__icontains=q) | DQ(tags__icontains=q)
        )[:5]
        return Response(RepairImageSerializer(results, many=True).data)
