# NovaStore — E-commerce Full-Stack (Django REST + React + TypeScript)

Plataforma completa de e-commerce desenvolvida com **Django 5 + Django REST Framework** no back-end e **React 19 + TypeScript + Vite + Tailwind CSS v4** no front-end.

---

## Principais Funcionalidades

- **Autenticação JWT & Controle de Acesso por Grupos (RBAC):**
  - Autenticação via `djangorestframework-simplejwt` com renovação automática de token (`access` / `refresh`) via interceptor Axios.
  - Diferenciação nativa pelos grupos do Django Admin: **`Vendedor`** (pode cadastrar, editar e excluir produtos, além de gerenciar o status de todos os pedidos da loja) e **`Cliente`** (compra, avalia produtos entregues e acompanha seus próprios pedidos).
- **Vitrine Dinâmica & Carrossel Infinito de Destaques:**
  - Carrossel horizontal infinito de banners verticais (estilo Amazon) alimentado pelos produtos marcados como `featured=True`.
  - Filtro por categorias, busca textual em tempo real e ordenação por preço, nome, data ou destaques.
- **Página de Detalhes do Produto & Avaliações Verificadas:**
  - Visualização detalhada com cálculo de parcelamento, estoque em tempo real e produtos relacionados.
  - Sistema de avaliações (1 a 5 estrelas + comentário) protegido contra *fake reviews*: exclusivo para clientes que compraram o produto e tiveram o pedido confirmado como **Entregue (`delivered`)**, com limite de 1 avaliação única atualizável por cliente/produto.
- **Carrinho Híbrido (Multi-dispositivo) & Trava de Estoque:**
  - Visitantes anônimos utilizam `localStorage` com sincronização entre abas.
  - Ao fazer login, o sistema realiza o **merge automático** do carrinho local com as tabelas `Cart` e `CartItem` no banco de dados do Django, mantendo o carrinho sincronizado em qualquer dispositivo.
  - Trava preventiva de estoque real tanto no front-end quanto no back-end, utilizando `select_for_update()` em transação atômica (`@transaction.atomic`) no momento do checkout para evitar *race conditions*.
- **Checkout Completo com Busca de CEP & Múltiplas Formas de Pagamento:**
  - Preenchimento automático de endereço a partir do CEP integrando **ViaCEP** e **BrasilAPI** (fallback), com cálculo de frete regional (**PAC** e **SEDEX Full**).
  - Suporte a **PIX (5% de desconto automático)**, **Cartão de Crédito (até 10x sem juros)**, **Cartão de Débito** e **Boleto Bancário**, além de cupons promocionais (`BEMVINDO10` e `FRETEGRATIS`).
- **Meus Pedidos (Cliente) & Gestão Geral de Pedidos (Vendedor/Admin):**
  - Histórico completo com endereço de entrega, forma de pagamento e preços unitários congelados no momento da compra.
  - Alteração de status em tempo real pelo vendedor (`Pendente`, `Pago`, `Enviado`, `Entregue`, `Cancelado`), com **estorno automático de estoque** ao cancelar um pedido.

---

## Estrutura do Projeto

```text
ecommerce/
├── backend/                        # API Django REST Framework
│   ├── config/                     # Configurações globais, URLs, JWT, CORS e Banco de Dados
│   ├── store/                      # App principal da loja
│   │   ├── migrations/             # Migrações do banco de dados
│   │   ├── admin.py                # Configuração do Django Admin
│   │   ├── auth_views.py           # Login JWT customizado, Registro e Perfil (/api/auth/)
│   │   ├── models.py               # Category, Product, Cart, CartItem, Order, OrderItem, Review
│   │   ├── permissions.py          # Permissões RBAC (Grupos Vendedor vs. Cliente)
│   │   ├── serializers.py          # Serializers DRF e validações
│   │   ├── urls.py                 # Rotas da API (/api/store/)
│   │   └── views.py                # ViewSets e regras de negócio (merge, checkout, status, reviews)
│   ├── .env.example                # Exemplo de variáveis de ambiente
│   ├── manage.py
│   ├── requirements.txt
│   └── seed.py                     # Popula grupos, usuários de teste, categorias e produtos
└── frontend/                       # Aplicação React + TypeScript + Vite + Tailwind CSS
    ├── src/
    │   ├── components/
    │   │   ├── AuthModal.tsx       # Modal de Login e Cadastro com acesso rápido de teste
    │   │   ├── CheckoutView.tsx    # Página de Checkout (ViaCEP, Frete, PIX/Cartão/Boleto)
    │   │   ├── FeaturedCarousel.tsx# Carrossel infinito de banners verticais em destaque
    │   │   ├── OrdersView.tsx      # Meus Pedidos (Cliente) e Gestão de Pedidos (Vendedor)
    │   │   ├── ProductDetailView.tsx # Detalhes do produto e avaliações pós-entrega
    │   │   └── ProductFormModal.tsx# Cadastro e edição de produtos (Vendedor/Admin)
    │   ├── services/api.ts         # Cliente Axios com interceptors JWT e integração ViaCEP
    │   ├── types/store.ts          # Tipagens TypeScript
    │   ├── App.tsx                 # Layout principal, estado global e Carrinho Híbrido
    │   └── main.tsx
    ├── package.json
    └── vite.config.ts
```

---

## Como Executar Localmente

### 1. Back-end (Django)

```bash
cd backend
python -m venv venv

# No Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# No Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python seed.py
python manage.py runserver
```

- **API Base:** `http://127.0.0.1:8000/api/`
- **Django Admin:** `http://127.0.0.1:8000/admin/`

### 2. Front-end (React + TypeScript)

```bash
cd frontend
npm install
npm run dev
```

- **Aplicação Web:** `http://localhost:5173`

---

## Contas de Teste Criadas pelo `seed.py`

| Perfil | Usuário | Senha | Permissões |
| :--- | :--- | :--- | :--- |
| **Vendedor / Admin** | `vendedor` | `vendedor123` | Cadastrar/editar/excluir produtos e gerenciar todos os pedidos |
| **Superusuário** | `admin` | `admin123` | Acesso total à loja e ao Django Admin (`/admin/`) |
| **Cliente** | `cliente` | `cliente123` | Comprar, usar carrinho híbrido, ver seus pedidos e avaliar produtos entregues |
