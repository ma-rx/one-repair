from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Asset, AssetStatus, Organization, Part, PartUsed,
    ServiceReport, Store, Ticket, TicketStatus, UserRole,
)
from .permissions import IsClientAdmin, IsClientAdminOrManager, IsORSAdmin
from .serializers import (
    AssetSerializer, AssignTechSerializer, CloseTicketSerializer,
    CreateUserSerializer, OrganizationSerializer, PartSerializer,
    ServiceReportSerializer, StoreSerializer, TicketSerializer, UserSerializer,
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
        qs = Part.objects.all()
        asset_category = self.request.query_params.get("asset_category")
        if asset_category:
            qs = qs.filter(asset_category=asset_category)
        return qs


# ── Tickets ───────────────────────────────────────────────────────────────────

class TicketViewSet(viewsets.ModelViewSet):
    serializer_class = TicketSerializer

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, "profile", None)

        base = Ticket.objects.select_related(
            "asset__store__organization", "assigned_tech"
        ).prefetch_related("service_reports__parts_used__part")

        if profile is None:
            return Ticket.objects.none()

        if profile.role == UserRole.ORS_ADMIN:
            qs = base
        elif profile.role == UserRole.TECH:
            qs = base.filter(assigned_tech=user)
        elif profile.role == UserRole.CLIENT_MANAGER and profile.store:
            qs = base.filter(asset__store=profile.store)
        elif profile.organization:
            qs = base.filter(asset__store__organization=profile.organization)
        else:
            return Ticket.objects.none()

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs

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
        ticket.status = TicketStatus.IN_PROGRESS
        ticket.save(update_fields=["assigned_tech", "status", "updated_at"])

        return Response(TicketSerializer(ticket).data)

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

        with transaction.atomic():
            service_report = ServiceReport.objects.create(
                ticket=ticket,
                submitted_by=request.user,
                resolution_code=data["resolution_code"],
                labor_cost=data["labor_cost"],
                invoice_email=data.get("invoice_email", ""),
            )

            for pu_input in data.get("parts_used", []):
                part = part_objects[str(pu_input["part_id"])]
                PartUsed.objects.create(
                    service_report=service_report,
                    part=part,
                    quantity=pu_input["quantity"],
                    unit_price_at_time=part.unit_price,
                )
                part.quantity_on_hand -= pu_input["quantity"]
                part.save(update_fields=["quantity_on_hand", "updated_at"])

            ticket.status = TicketStatus.CLOSED
            ticket.save(update_fields=["status", "updated_at"])

            asset = ticket.asset
            asset.status = AssetStatus.OPERATIONAL
            asset.save(update_fields=["status", "updated_at"])

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


# ── Service Reports ───────────────────────────────────────────────────────────

class ServiceReportViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ServiceReportSerializer

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
