from rest_framework.permissions import BasePermission
from .models import UserRole


class IsORSAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and hasattr(request.user, "profile")
            and request.user.profile.role == UserRole.ORS_ADMIN
        )


class IsClientAdmin(BasePermission):
    """ORS Admin or Client Admin."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and hasattr(request.user, "profile")
            and request.user.profile.role in [UserRole.ORS_ADMIN, UserRole.CLIENT_ADMIN]
        )


class IsClientAdminOrManager(BasePermission):
    """ORS Admin, Client Admin, or Client Manager."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and hasattr(request.user, "profile")
            and request.user.profile.role in [
                UserRole.ORS_ADMIN,
                UserRole.CLIENT_ADMIN,
                UserRole.CLIENT_MANAGER,
            ]
        )
