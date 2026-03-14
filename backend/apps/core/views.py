from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Avg, Count, F, Sum
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
    Asset, AssetStatus, Organization, Part, PartUsed, PricingConfig,
    ServiceReport, Store, Ticket, TicketStatus, TimeEntry, UserRole, WorkImage,
)
from .permissions import IsClientAdmin, IsClientAdminOrManager, IsORSAdmin
from .serializers import (
    AssetSerializer, AssignTechSerializer, CloseTicketSerializer,
    CreateUserSerializer, OrganizationSerializer, PartSerializer,
    PricingConfigSerializer, ServiceReportSerializer, StoreSerializer,
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
                    unit_price_at_time=part.unit_price,
                )
                part.quantity_on_hand -= pu_input["quantity"]
                part.save(update_fields=["quantity_on_hand", "updated_at"])

            ticket.status = TicketStatus.CLOSED
            ticket.closed_at = timezone.now()
            ticket.save(update_fields=["status", "closed_at", "updated_at"])

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
                        "Edit these notes for clarity, grammar, and professional structure while "
                        "preserving ALL technical details and facts. Do not add any information "
                        "that is not already present in the notes. "
                        "Return only the formatted report text, no preamble.\n\n"
                        f"Technician notes:\n{notes}"
                    ),
                }],
            )
            return Response({"formatted_report": message.content[0].text})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
