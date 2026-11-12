from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Cart, CartItem, Category, Order, OrderItem, Product, Review
from .pagination import CatalogPagination
from .permissions import IsSellerOrAdminOrReadOnly, user_is_seller_or_admin
from .serializers import (
    CartSerializer,
    CategorySerializer,
    OrderSerializer,
    ProductSerializer,
    ReviewSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsSellerOrAdminOrReadOnly]
    pagination_class = None
    lookup_field = 'slug'


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related('category').prefetch_related('reviews').all()
    serializer_class = ProductSerializer
    permission_classes = [IsSellerOrAdminOrReadOnly]
    pagination_class = CatalogPagination
    filterset_fields = ['category__slug', 'featured']
    search_fields = ['name', 'description', 'category__name']
    ordering_fields = ['price', 'created_at', 'name']

    def get_queryset(self):
        qs = super().get_queryset()
        if user_is_seller_or_admin(self.request.user):
            return qs
        return qs.filter(is_active=True)

    @action(detail=True, methods=['post'], url_path='soft-delete')
    @transaction.atomic
    def soft_delete(self, request, pk=None):
        """
        Soft Delete / Reativação: Alterna o status ativo (is_active) do produto no banco,
        preservando integralmente os OrderItems e removendo de carrinhos abertos se desativado.
        """
        product = self.get_object()
        desired_state = request.data.get('is_active')
        if desired_state is None:
            product.is_active = not product.is_active
        else:
            product.is_active = bool(desired_state)

        product.save(update_fields=['is_active', 'updated_at'])

        if not product.is_active:
            CartItem.objects.filter(product=product).delete()

        return Response(ProductSerializer(product, context={'request': request}).data)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        """
        Hard Delete: Antes de excluir definitivamente o produto do banco de dados,
        garante que todos os OrderItems históricos vinculados a ele preservem o
        snapshot de nome e imagem para não quebrar o histórico financeiro de pedidos.
        """
        product = self.get_object()
        OrderItem.objects.filter(product=product).update(
            product_name_snapshot=product.name,
            product_image_snapshot=product.image_url or '',
        )
        return super().destroy(request, *args, **kwargs)

    @action(
        detail=True,
        methods=['get', 'post'],
        url_path='reviews',
        permission_classes=[permissions.IsAuthenticatedOrReadOnly],
    )
    @transaction.atomic
    def reviews(self, request, pk=None):
        product = self.get_object()
        if request.method == 'GET':
            qs = product.reviews.select_related('user').all()
            return Response(ReviewSerializer(qs, many=True).data)

        # Regra de Negócio: Apenas clientes que possuem pedido ENTREGUE (delivered)
        # contendo este produto podem avaliá-lo.
        has_delivered_purchase = OrderItem.objects.filter(
            order__user=request.user,
            order__status=Order.Status.DELIVERED,
            product=product,
        ).exists()

        if not has_delivered_purchase:
            return Response(
                {
                    'detail': (
                        'Você só pode avaliar este produto após a confirmação de '
                        'entrega do seu pedido.'
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Regra de Negócio: 1 avaliação única por usuário/produto.
        # Se já existir, atualiza a nota e o comentário anterior.
        review, created = Review.objects.update_or_create(
            product=product,
            user=request.user,
            defaults={
                'rating': serializer.validated_data['rating'],
                'comment': serializer.validated_data['comment'],
            },
        )
        return Response(
            ReviewSerializer(review).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=['delete'],
        url_path=r'reviews/(?P<review_id>\d+)',
        permission_classes=[permissions.IsAuthenticated],
    )
    def delete_review(self, request, pk=None, review_id=None):
        product = self.get_object()
        review = Review.objects.filter(pk=review_id, product=product).first()
        if not review:
            return Response(
                {'detail': 'Avaliação não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if review.user != request.user and not user_is_seller_or_admin(request.user):
            return Response(
                {'detail': 'Você só pode excluir suas próprias avaliações.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        review.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CartViewSet(viewsets.ViewSet):
    """
    Gerencia o Carrinho Híbrido persistido no banco de dados para usuários autenticados,
    permitindo sincronização entre dispositivos e merge com o localStorage no login.
    """

    permission_classes = [permissions.IsAuthenticated]

    def _get_or_create_cart(self, user) -> Cart:
        cart, _ = Cart.objects.prefetch_related('items__product__category').get_or_create(
            user=user
        )
        return cart

    def list(self, request):
        cart = self._get_or_create_cart(request.user)
        return Response(CartSerializer(cart).data)

    @action(detail=False, methods=['post'], url_path='merge')
    @transaction.atomic
    def merge_local_cart(self, request):
        """
        Recebe os itens que estavam no localStorage de visitante:
        { "items": [{ "product_id": 1, "quantity": 2 }, ...] }
        e faz o merge com o carrinho salvo no banco de dados do usuário.
        """
        cart = self._get_or_create_cart(request.user)
        incoming_items = request.data.get('items', [])

        if isinstance(incoming_items, list):
            for entry in incoming_items:
                if not isinstance(entry, dict):
                    continue
                product_id = entry.get('product_id')
                quantity = int(entry.get('quantity', 0) or 0)
                if not product_id or quantity <= 0:
                    continue

                product = Product.objects.filter(pk=product_id, is_active=True).first()
                if not product or product.stock <= 0:
                    continue

                capped_initial = min(quantity, product.stock)
                cart_item, created = CartItem.objects.get_or_create(
                    cart=cart,
                    product=product,
                    defaults={'quantity': capped_initial},
                )
                if not created:
                    cart_item.quantity = min(
                        cart_item.quantity + quantity, product.stock
                    )
                    cart_item.save(update_fields=['quantity', 'updated_at'])

        cart = self._get_or_create_cart(request.user)
        return Response(CartSerializer(cart).data)

    @action(detail=False, methods=['post'], url_path='item')
    @transaction.atomic
    def set_item_quantity(self, request):
        """
        Define ou atualiza a quantidade de um produto no carrinho do banco,
        respeitando estritamente o limite de estoque real (product.stock).
        Se quantity <= 0, remove o item do carrinho.
        """
        cart = self._get_or_create_cart(request.user)
        product_id = request.data.get('product_id')
        quantity = int(request.data.get('quantity', 0) or 0)

        if not product_id:
            return Response(
                {'detail': 'product_id é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if quantity <= 0:
            CartItem.objects.filter(cart=cart, product_id=product_id).delete()
        else:
            product = Product.objects.filter(pk=product_id, is_active=True).first()
            if not product:
                return Response(
                    {'detail': 'Produto não encontrado ou inativo.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if product.stock <= 0:
                CartItem.objects.filter(cart=cart, product=product).delete()
                return Response(
                    {'detail': f'O produto "{product.name}" está esgotado.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if quantity > product.stock:
                return Response(
                    {
                        'detail': (
                            f'Quantidade solicitada ({quantity}) excede o estoque '
                            f'disponível de "{product.name}" ({product.stock} un.).'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            CartItem.objects.update_or_create(
                cart=cart,
                product=product,
                defaults={'quantity': quantity},
            )

        cart = self._get_or_create_cart(request.user)
        return Response(CartSerializer(cart).data)

    @action(detail=False, methods=['delete'], url_path='clear')
    def clear_cart(self, request):
        cart = self._get_or_create_cart(request.user)
        cart.items.all().delete()
        cart = self._get_or_create_cart(request.user)
        return Response(CartSerializer(cart).data)

    @action(detail=False, methods=['post'], url_path='checkout')
    @transaction.atomic
    def checkout(self, request):
        """
        Converte os itens atuais do Carrinho do usuário em um Pedido (Order + OrderItem),
        travando as linhas de produto no banco (select_for_update) para evitar concorrência,
        validando/baixando o estoque real e limpando o carrinho.
        """
        cart = self._get_or_create_cart(request.user)
        cart_items = list(cart.items.select_related('product').all())
        if not cart_items:
            return Response(
                {'detail': 'Seu carrinho está vazio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Trava os produtos no banco (select_for_update) para evitar race condition de estoque
        product_ids = [item.product_id for item in cart_items]
        locked_products = {
            p.id: p
            for p in Product.objects.select_for_update().filter(id__in=product_ids)
        }

        # Valida disponibilidade de estoque real com lock ativo
        for item in cart_items:
            locked_prod = locked_products.get(item.product_id)
            if not locked_prod or not locked_prod.is_active:
                return Response(
                    {'detail': f'O produto "{item.product.name}" não está mais disponível.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if locked_prod.stock < item.quantity:
                return Response(
                    {
                        'detail': (
                            f'Estoque insuficiente para "{locked_prod.name}". '
                            f'Disponível: {locked_prod.stock} un.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        customer_name = (
            request.data.get('customer_name', '').strip()
            or f'{request.user.first_name} {request.user.last_name}'.strip()
            or request.user.username
        )
        customer_email = (
            request.data.get('customer_email', '').strip()
            or request.user.email
            or f'{request.user.username}@ecommerce.local'
        )

        payment_method = request.data.get('payment_method', Order.PaymentMethod.PIX)
        valid_methods = dict(Order.PaymentMethod.choices).keys()
        if payment_method not in valid_methods:
            payment_method = Order.PaymentMethod.PIX

        installments = max(1, min(10, int(request.data.get('installments', 1) or 1)))
        if payment_method != Order.PaymentMethod.CREDIT_CARD:
            installments = 1

        shipping_cep = str(request.data.get('shipping_cep', '')).strip()[:12]
        shipping_address = str(request.data.get('shipping_address', '')).strip()
        if not shipping_cep or not shipping_address:
            return Response(
                {'detail': 'Por favor, informe o CEP e o endereço completo de entrega.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_shipping = Decimal(str(request.data.get('shipping_cost', '0') or '0'))
        shipping_cost = max(Decimal('0.00'), raw_shipping).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        coupon_code = str(request.data.get('coupon_code', '')).strip().upper()

        initial_status = (
            Order.Status.PENDING
            if payment_method == Order.PaymentMethod.BOLETO
            else Order.Status.PAID
        )

        order = Order.objects.create(
            user=request.user,
            customer_name=customer_name,
            customer_email=customer_email,
            status=initial_status,
            payment_method=payment_method,
            installments=installments,
            shipping_cep=shipping_cep,
            shipping_address=shipping_address,
            shipping_cost=shipping_cost,
        )

        subtotal = Decimal('0.00')
        for item in cart_items:
            locked_prod = locked_products[item.product_id]
            unit_price = locked_prod.price
            OrderItem.objects.create(
                order=order,
                product=locked_prod,
                product_name_snapshot=locked_prod.name,
                product_image_snapshot=locked_prod.image_url or '',
                quantity=item.quantity,
                unit_price=unit_price,
            )
            locked_prod.stock -= item.quantity
            locked_prod.save(update_fields=['stock', 'updated_at'])
            subtotal += unit_price * item.quantity

        # Desconto de 5% no PIX + cupom opcional (BEMVINDO10 = 10% OFF, FRETEGRATIS = frete zero)
        discount = Decimal('0.00')
        if payment_method == Order.PaymentMethod.PIX:
            discount += (subtotal * Decimal('0.05')).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
        if coupon_code == 'BEMVINDO10':
            discount += (subtotal * Decimal('0.10')).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
        elif coupon_code == 'FRETEGRATIS':
            shipping_cost = Decimal('0.00')
            order.shipping_cost = shipping_cost

        total = max(Decimal('0.00'), subtotal - discount + shipping_cost)

        order.subtotal_amount = subtotal
        order.discount_amount = discount
        order.total_amount = total
        order.save(
            update_fields=[
                'subtotal_amount',
                'discount_amount',
                'shipping_cost',
                'total_amount',
            ]
        )

        # Limpa o carrinho após fechar o pedido
        cart.items.all().delete()

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.prefetch_related('items__product').all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # Vendedor/Admin visualiza todos os pedidos gerais da loja;
        # Cliente visualiza exclusivamente os pedidos vinculados ao seu próprio ID de usuário.
        if user_is_seller_or_admin(self.request.user):
            return qs
        return qs.filter(user=self.request.user)

    @action(detail=True, methods=['patch'], url_path='status')
    @transaction.atomic
    def update_status(self, request, pk=None):
        """
        Permite que Vendedor/Admin atualize o status de um pedido.
        Se o pedido for alterado para 'canceled', devolve automaticamente os itens ao estoque.
        """
        if not user_is_seller_or_admin(request.user):
            return Response(
                {'detail': 'Apenas vendedores ou administradores podem alterar o status.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        order = self.get_object()
        new_status = request.data.get('status')
        valid_statuses = dict(Order.Status.choices).keys()

        if new_status not in valid_statuses:
            return Response(
                {'detail': f'Status inválido. Opções: {", ".join(valid_statuses)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_status = order.status
        if old_status != new_status:
            # Se mudou para cancelado, estorna a quantidade para o estoque dos produtos
            if new_status == Order.Status.CANCELED and old_status != Order.Status.CANCELED:
                for item in order.items.select_related('product').all():
                    if item.product:
                        item.product.stock += item.quantity
                        item.product.save(update_fields=['stock', 'updated_at'])
            # Se estava cancelado e voltou para um status ativo, baixa novamente do estoque
            elif old_status == Order.Status.CANCELED and new_status != Order.Status.CANCELED:
                for item in order.items.select_related('product').all():
                    if not item.product:
                        continue
                    if item.product.stock < item.quantity:
                        return Response(
                            {
                                'detail': (
                                    f'Estoque insuficiente para reativar "{item.product.name}". '
                                    f'Disponível: {item.product.stock} un.'
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    item.product.stock -= item.quantity
                    item.product.save(update_fields=['stock', 'updated_at'])

            order.status = new_status
            order.save(update_fields=['status', 'updated_at'])

        return Response(OrderSerializer(order).data)
