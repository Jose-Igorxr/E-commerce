from rest_framework import permissions

SELLER_GROUP_NAME = 'Vendedor'
CUSTOMER_GROUP_NAME = 'Cliente'


def user_is_seller_or_admin(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    return user.groups.filter(name=SELLER_GROUP_NAME).exists()


class IsSellerOrAdminOrReadOnly(permissions.BasePermission):
    """
    Permite leitura pública (GET, HEAD, OPTIONS), mas restringe escrita
    (POST, PUT, PATCH, DELETE) apenas a usuários do grupo 'Vendedor' ou admins.
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return user_is_seller_or_admin(request.user)
