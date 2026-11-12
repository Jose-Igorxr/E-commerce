from django.db.models import Avg
from django.utils.text import slugify
from rest_framework import serializers
from .models import Cart, CartItem, Category, Order, OrderItem, Product, Review
from .permissions import user_is_seller_or_admin


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)
    is_seller = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            'id',
            'product',
            'user',
            'username',
            'user_name',
            'is_seller',
            'rating',
            'comment',
            'created_at',
        ]
        read_only_fields = ['product', 'user', 'username', 'user_name', 'is_seller', 'created_at']

    def get_user_name(self, obj) -> str:
        full_name = f'{obj.user.first_name} {obj.user.last_name}'.strip()
        return full_name or obj.user.username

    def get_is_seller(self, obj) -> bool:
        return user_is_seller_or_admin(obj.user)


class CategorySerializer(serializers.ModelSerializer):
    products_count = serializers.IntegerField(source='products.count', read_only=True)
    slug = serializers.SlugField(max_length=120, required=False, allow_blank=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'products_count', 'created_at']

    def validate(self, attrs):
        slug = attrs.get('slug')
        name = attrs.get('name') or (self.instance.name if self.instance else '')
        if not slug and name:
            base_slug = slugify(name) or 'categoria'
            candidate = base_slug
            counter = 1
            qs = Category.objects.all()
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            while qs.filter(slug=candidate).exists():
                counter += 1
                candidate = f'{base_slug}-{counter}'
            attrs['slug'] = candidate
        return attrs


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    slug = serializers.SlugField(max_length=220, required=False, allow_blank=True)
    average_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    user_can_review = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'category',
            'category_name',
            'name',
            'slug',
            'description',
            'price',
            'stock',
            'image_url',
            'image',
            'is_active',
            'featured',
            'average_rating',
            'reviews_count',
            'user_can_review',
            'created_at',
            'updated_at',
        ]

    def get_average_rating(self, obj) -> float:
        avg = obj.reviews.aggregate(avg_val=Avg('rating'))['avg_val']
        return round(float(avg), 1) if avg is not None else 0.0

    def get_reviews_count(self, obj) -> int:
        return obj.reviews.count()

    def get_user_can_review(self, obj) -> bool:
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return OrderItem.objects.filter(
            order__user=request.user,
            order__status=Order.Status.DELIVERED,
            product=obj,
        ).exists()

    def validate(self, attrs):
        slug = attrs.get('slug')
        name = attrs.get('name') or (self.instance.name if self.instance else '')
        if not slug and name:
            base_slug = slugify(name) or 'produto'
            candidate = base_slug
            counter = 1
            qs = Product.objects.all()
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            while qs.filter(slug=candidate).exists():
                counter += 1
                candidate = f'{base_slug}-{counter}'
            attrs['slug'] = candidate
        return attrs


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.filter(is_active=True),
        source='product',
        write_only=True,
    )

    class Meta:
        model = CartItem
        fields = ['id', 'product', 'product_id', 'quantity', 'updated_at']


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = ['id', 'user', 'items', 'updated_at']
        read_only_fields = ['user', 'updated_at']


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    unit_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = OrderItem
        fields = [
            'id',
            'product',
            'product_name',
            'product_image',
            'quantity',
            'unit_price',
        ]

    def get_product_name(self, obj) -> str:
        if obj.product:
            return obj.product.name
        return obj.product_name_snapshot or 'Produto Removido Permanentemente'

    def get_product_image(self, obj) -> str:
        if obj.product:
            return obj.product.image_url or ''
        return obj.product_image_snapshot or ''


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(
        source='get_payment_method_display', read_only=True
    )
    subtotal_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    shipping_cost = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    discount_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    total_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = Order
        fields = [
            'id',
            'user',
            'customer_name',
            'customer_email',
            'status',
            'status_display',
            'payment_method',
            'payment_method_display',
            'installments',
            'subtotal_amount',
            'shipping_cost',
            'discount_amount',
            'total_amount',
            'shipping_cep',
            'shipping_address',
            'items',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'status',
            'status_display',
            'payment_method_display',
            'subtotal_amount',
            'shipping_cost',
            'discount_amount',
            'total_amount',
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        order = Order.objects.create(**validated_data)
        total = 0
        for item_data in items_data:
            product = item_data['product']
            quantity = item_data['quantity']
            # Segurança: busca sempre o preço real no banco de dados, nunca do cliente
            unit_price = product.price
            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
            )
            total += unit_price * quantity
        order.total_amount = total
        order.save(update_fields=['total_amount'])
        return order
