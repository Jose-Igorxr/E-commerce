import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from store.models import Category, Order, OrderItem, Product, Review
from store.permissions import CUSTOMER_GROUP_NAME, SELLER_GROUP_NAME


def run_seed():
    User = get_user_model()

    # 1. Cria os grupos no Django Admin (Vendedor e Cliente)
    seller_group, _ = Group.objects.get_or_create(name=SELLER_GROUP_NAME)
    customer_group, _ = Group.objects.get_or_create(name=CUSTOMER_GROUP_NAME)

    # Associa permissões de Produto e Categoria ao grupo Vendedor no Django Admin
    for model in (Category, Product):
        ct = ContentType.objects.get_for_model(model)
        perms = Permission.objects.filter(content_type=ct)
        seller_group.permissions.add(*perms)

    # 2. Cria Superusuário Admin
    admin_user, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@ecommerce.local',
            'first_name': 'Administrador',
            'is_staff': True,
            'is_superuser': True,
        },
    )
    if created:
        admin_user.set_password('admin123')
        admin_user.save()
    admin_user.groups.add(seller_group)

    # 3. Cria Usuário Vendedor de teste (no grupo Vendedor)
    seller_user, created = User.objects.get_or_create(
        username='vendedor',
        defaults={
            'email': 'vendedor@ecommerce.local',
            'first_name': 'Carlos',
            'last_name': 'Vendedor',
            'is_staff': True,
        },
    )
    if created:
        seller_user.set_password('vendedor123')
        seller_user.save()
    seller_user.groups.add(seller_group)

    # 4. Cria Usuário Cliente de teste (no grupo Cliente)
    customer_user, created = User.objects.get_or_create(
        username='cliente',
        defaults={
            'email': 'cliente@ecommerce.local',
            'first_name': 'Ana',
            'last_name': 'Cliente',
            'is_staff': False,
        },
    )
    if created:
        customer_user.set_password('cliente123')
        customer_user.save()
    customer_user.groups.add(customer_group)

    categories_data = [
        {
            'name': 'Eletrônicos',
            'slug': 'eletronicos',
            'description': 'Smartphones, notebooks, fones e acessórios de alta tecnologia.',
        },
        {
            'name': 'Periféricos Gamer',
            'slug': 'perifericos-gamer',
            'description': 'Teclados mecânicos, mouses de alta precisão e monitores.',
        },
        {
            'name': 'Áudio & Som',
            'slug': 'audio-som',
            'description': 'Headsets, caixas de som Bluetooth e equipamentos de estúdio.',
        },
    ]

    categories = {}
    for cat_data in categories_data:
        cat, _ = Category.objects.update_or_create(
            slug=cat_data['slug'], defaults=cat_data
        )
        categories[cat.slug] = cat

    products_data = [
        {
            'category': categories['eletronicos'],
            'name': 'Notebook Pro Ultra 16"',
            'slug': 'notebook-pro-ultra-16',
            'description': 'Processador de última geração, 32GB RAM, SSD NVMe 1TB e tela OLED 120Hz.',
            'price': '7499.90',
            'stock': 15,
            'image_url': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
            'featured': True,
        },
        {
            'category': categories['perifericos-gamer'],
            'name': 'Teclado Mecânico RGB Wireless',
            'slug': 'teclado-mecanico-rgb-wireless',
            'description': 'Switches táteis silenciosos, estrutura em alumínio e bateria de longa duração.',
            'price': '549.90',
            'stock': 42,
            'image_url': 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80',
            'featured': True,
        },
        {
            'category': categories['audio-som'],
            'name': 'Headphone Studio ANC Wireless',
            'slug': 'headphone-studio-anc-wireless',
            'description': 'Cancelamento ativo de ruído, autonomia de 40h e áudio espacial de alta fidelidade.',
            'price': '1299.00',
            'stock': 28,
            'image_url': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
            'featured': True,
        },
        {
            'category': categories['perifericos-gamer'],
            'name': 'Mouse Gamer Ultraleve 26000 DPI',
            'slug': 'mouse-gamer-ultraleve-26000-dpi',
            'description': 'Apenas 54g, sensor óptico de precisão profissional e switches ópticos.',
            'price': '389.90',
            'stock': 60,
            'image_url': 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=800&q=80',
            'featured': True,
        },
        {
            'category': categories['eletronicos'],
            'name': 'Smartphone Flagship 5G 256GB',
            'slug': 'smartphone-flagship-5g-256gb',
            'description': 'Câmera tripla Pro de 200MP, tela AMOLED 120Hz e carregamento ultrarrápido.',
            'price': '4299.00',
            'stock': 22,
            'image_url': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
            'featured': True,
        },
        {
            'category': categories['perifericos-gamer'],
            'name': 'Monitor Curvo Ultrawide 34" 165Hz',
            'slug': 'monitor-curvo-ultrawide-34-165hz',
            'description': 'Resolução WQHD, 1ms de resposta, HDR400 e FreeSync Premium para imersão total.',
            'price': '2899.90',
            'stock': 12,
            'image_url': 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80',
            'featured': True,
        },
        {
            'category': categories['audio-som'],
            'name': 'Caixa de Som Smart Bluetooth 360°',
            'slug': 'caixa-de-som-smart-bluetooth-360',
            'description': 'Graves potentes, resistência à água IP67 e integração com assistente de voz.',
            'price': '699.90',
            'stock': 35,
            'image_url': 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80',
            'featured': False,
        },
        {
            'category': categories['eletronicos'],
            'name': 'Smartwatch Titanium GPS Pro',
            'slug': 'smartwatch-titanium-gps-pro',
            'description': 'Caixa em titânio, vidro de safira, monitoramento avançado de saúde e bateria de 7 dias.',
            'price': '1899.00',
            'stock': 19,
            'image_url': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
            'featured': True,
        },
    ]

    for prod_data in products_data:
        Product.objects.update_or_create(
            slug=prod_data['slug'], defaults=prod_data
        )

    # Garante que haja um pedido ENTREGUE (delivered) para a cliente de teste
    # correspondente às avaliações iniciais
    if not Order.objects.filter(user=customer_user, status=Order.Status.DELIVERED).exists():
        delivered_order = Order.objects.create(
            user=customer_user,
            customer_name='Ana Cliente',
            customer_email=customer_user.email,
            status=Order.Status.DELIVERED,
            total_amount=0,
        )
        order_total = 0
        for slug in (
            'notebook-pro-ultra-16',
            'teclado-mecanico-rgb-wireless',
            'headphone-studio-anc-wireless',
        ):
            prod = Product.objects.filter(slug=slug).first()
            if prod:
                OrderItem.objects.create(
                    order=delivered_order,
                    product=prod,
                    quantity=1,
                    unit_price=prod.price,
                )
                order_total += prod.price
        delivered_order.total_amount = order_total
        delivered_order.save(update_fields=['total_amount'])

    # Cria ou atualiza avaliações únicas de exemplo
    sample_reviews = [
        (
            'notebook-pro-ultra-16',
            customer_user,
            5,
            'Desempenho absurdo! A tela OLED 120Hz é impecável para trabalho e edição.',
        ),
        (
            'teclado-mecanico-rgb-wireless',
            customer_user,
            5,
            'Switches super macios e silenciosos, e a bateria dura semanas sem precisar carregar.',
        ),
        (
            'headphone-studio-anc-wireless',
            customer_user,
            4,
            'Cancelamento de ruído excelente e muito confortável para usar o dia todo.',
        ),
    ]
    for slug, rev_user, rating, comment in sample_reviews:
        prod = Product.objects.filter(slug=slug).first()
        if prod:
            Review.objects.update_or_create(
                product=prod,
                user=rev_user,
                defaults={
                    'rating': rating,
                    'comment': comment,
                },
            )

    print(
        f'Seed concluído: grupos ({SELLER_GROUP_NAME}, {CUSTOMER_GROUP_NAME}), '
        f'usuários (admin, vendedor, cliente), '
        f'{Category.objects.count()} categorias e {Product.objects.count()} produtos.'
    )


if __name__ == '__main__':
    run_seed()
