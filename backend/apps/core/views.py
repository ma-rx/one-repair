from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Asset, AssetStatus, Part, PartUsed, ServiceReport, Ticket, TicketStatus
from .serializers import (
    AssetSerializer, AssignTechSerializer, CloseTicketSerializer,
    PartSerializer, ServiceReportSerializer, TicketSerializer, UserSerializer,
)
from .services.email_service import send_invoice_email
from .services.invoice import generate_invoice_pdf


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSerializer

    def get_queryset(self):
        qs = User.objects.select_related("profile")
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(profile__role=role)
        return qs


class AssetViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Asset.objects.select_related("store__organization").all()
    serializer_class = AssetSerializer


class PartViewSet(viewsets.ModelViewSet):
    queryset = Part.objects.all()
    serializer_class = PartSerializer


class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.select_related(
        "asset__store__organization", "assigned_tech"
    ).prefetch_related("service_reports__parts_used__part").all()
    serializer_class = TicketSerializer

    def get_queryset(self):
        qs = super().get_queryset()
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

        # Validate stock before touching anything
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

        # Atomic write: service report + part deductions + status updates
        with transaction.atomic():
            service_report = ServiceReport.objects.create(
                ticket=ticket,
                resolution_code=data["resolution_code"],
                labor_cost=data["labor_cost"],
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

        # Generate + send invoice (outside transaction so a send failure doesn't rollback)
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


class ServiceReportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        ServiceReport.objects
        .prefetch_related("parts_used__part")
        .select_related("ticket__asset__store__organization")
        .all()
    )
    serializer_class = ServiceReportSerializer
