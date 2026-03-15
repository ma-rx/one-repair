from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    AssetViewSet, ClientKPIView, FormatReportView, InvoicePDFView, KPIView,
    KnowledgeEntryViewSet, OrganizationViewSet, PartRequestViewSet, PartViewSet,
    PricingConfigView, ServiceReportViewSet, StoreViewSet, TicketViewSet,
    TimeEntryView, UserViewSet, WorkImageView,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("stores", StoreViewSet, basename="store")
router.register("assets", AssetViewSet, basename="asset")
router.register("parts", PartViewSet, basename="part")
router.register("tickets", TicketViewSet, basename="ticket")
router.register("service-reports", ServiceReportViewSet, basename="service-report")
router.register("part-requests", PartRequestViewSet, basename="part-request")
router.register("knowledge", KnowledgeEntryViewSet, basename="knowledge")

urlpatterns = router.urls + [
    path("kpis/", KPIView.as_view()),
    path("client-kpis/", ClientKPIView.as_view()),
    path("invoices/<uuid:pk>/pdf/", InvoicePDFView.as_view()),
    path("pricing/", PricingConfigView.as_view()),
    path("time-entries/", TimeEntryView.as_view()),
    path("work-images/", WorkImageView.as_view()),
    path("work-images/<uuid:pk>/", WorkImageView.as_view()),
    path("format-report/", FormatReportView.as_view()),
]
