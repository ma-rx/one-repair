from rest_framework.routers import DefaultRouter
from .views import AssetViewSet, PartViewSet, ServiceReportViewSet, TicketViewSet, UserViewSet

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("assets", AssetViewSet, basename="asset")
router.register("parts", PartViewSet, basename="part")
router.register("tickets", TicketViewSet, basename="ticket")
router.register("service-reports", ServiceReportViewSet, basename="service-report")

urlpatterns = router.urls
