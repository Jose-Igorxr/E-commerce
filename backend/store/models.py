from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Category(models.Model):
    name = models.CharField('Nome', max_length=120)
    slug = models.SlugField('Slug', max_length=140, unique=True)
    description = models.TextField('Descrição', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Categoria'
        verbose_name_plural = 'Categorias'
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    category = models.ForeignKey(
        Category,
        related_name='products',
        on_delete=models.CASCADE,
        verbose_name='Categoria',
    )
    name = models.CharField('Nome', max_length=200)
    slug = models.SlugField('Slug', max_length=220, unique=True)
    description = models.TextField('Descrição', blank=True)
    price = models.DecimalField('Preço', max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField('Estoque', default=0)
    image_url = models.URLField('URL da Imagem', blank=True)
    image = models.ImageField('Imagem', upload_to='products/', blank=True, null=True)
    is_active = models.BooleanField('Ativo', default=True)
    featured = models.BooleanField('Destaque', default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Produto'
        verbose_name_plural = 'Produtos'
        ordering = ['-featured', '-created_at']

    def __str__(self) -> str:
        return self.name


class Cart(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name='cart',
        on_delete=models.CASCADE,
        verbose_name='Usuário',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Carrinho'
        verbose_name_plural = 'Carrinhos'

    def __str__(self) -> str:
        return f'Carrinho de {self.user.username}'


class CartItem(models.Model):
    cart = models.ForeignKey(
        Cart,
        related_name='items',
        on_delete=models.CASCADE,
        verbose_name='Carrinho',
    )
    product = models.ForeignKey(
        Product,
        related_name='cart_items',
        on_delete=models.CASCADE,
        verbose_name='Produto',
    )
    quantity = models.PositiveIntegerField('Quantidade', default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Item do Carrinho'
        verbose_name_plural = 'Itens do Carrinho'
        unique_together = ('cart', 'product')
        ordering = ['id']

    def __str__(self) -> str:
        return f'{self.quantity}x {self.product.name} ({self.cart.user.username})'


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pendente'
        PAID = 'paid', 'Pago'
        SHIPPED = 'shipped', 'Enviado'
        DELIVERED = 'delivered', 'Entregue'
        CANCELED = 'canceled', 'Cancelado'

    class PaymentMethod(models.TextChoices):
        PIX = 'pix', 'PIX'
        CREDIT_CARD = 'credit_card', 'Cartão de Crédito'
        DEBIT_CARD = 'debit_card', 'Cartão de Débito'
        BOLETO = 'boleto', 'Boleto Bancário'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='orders',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    customer_name = models.CharField('Nome do Cliente', max_length=150)
    customer_email = models.EmailField('E-mail do Cliente')
    status = models.CharField(
        'Status',
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    payment_method = models.CharField(
        'Forma de Pagamento',
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.PIX,
    )
    installments = models.PositiveSmallIntegerField('Parcelas', default=1)
    subtotal_amount = models.DecimalField(
        'Subtotal dos Produtos', max_digits=10, decimal_places=2, default=0
    )
    shipping_cost = models.DecimalField(
        'Valor do Frete', max_digits=10, decimal_places=2, default=0
    )
    discount_amount = models.DecimalField(
        'Valor do Desconto', max_digits=10, decimal_places=2, default=0
    )
    total_amount = models.DecimalField(
        'Valor Total', max_digits=10, decimal_places=2, default=0
    )
    shipping_cep = models.CharField('CEP de Entrega', max_length=12, blank=True)
    shipping_address = models.TextField('Endereço de Entrega', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Pedido'
        verbose_name_plural = 'Pedidos'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'Pedido #{self.pk} - {self.customer_name}'


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        related_name='items',
        on_delete=models.CASCADE,
        verbose_name='Pedido',
    )
    product = models.ForeignKey(
        Product,
        related_name='order_items',
        on_delete=models.PROTECT,
        verbose_name='Produto',
    )
    quantity = models.PositiveIntegerField('Quantidade', default=1)
    unit_price = models.DecimalField('Preço Unitário', max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = 'Item do Pedido'
        verbose_name_plural = 'Itens do Pedido'

    def __str__(self) -> str:
        return f'{self.quantity}x {self.product.name}'


class Review(models.Model):
    product = models.ForeignKey(
        Product,
        related_name='reviews',
        on_delete=models.CASCADE,
        verbose_name='Produto',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='reviews',
        on_delete=models.CASCADE,
        verbose_name='Usuário',
    )
    rating = models.PositiveSmallIntegerField(
        'Nota (1 a 5)',
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
    )
    comment = models.TextField('Comentário')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Avaliação'
        verbose_name_plural = 'Avaliações'
        unique_together = ('product', 'user')
        ordering = ['-updated_at', '-created_at']

    def __str__(self) -> str:
        return f'{self.rating}★ por {self.user.username} em {self.product.name}'
