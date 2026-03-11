from rest_framework.routers import DefaultRouter
from .views import (
    AssetViewSet, OrganizationViewSet, PartViewSet,
    ServiceReportViewSet, StoreViewSet, TicketViewSet, UserViewSet,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("stores", StoreViewSet, basename="store")
router.register("assets", AssetViewSet, basename="asset")
router.register("parts", PartViewSet, basename="part")
router.register("tickets", TicketViewSet, basename="ticket")
router.register("service-reports", ServiceReportViewSet, basename="service-report")

urlpatterns = router.urls
