import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ShoppingBag,
  Search,
  Sparkles,
  CheckCircle2,
  Plus,
  Minus,
  Trash2,
  X,
  Package,
  LogIn,
  LogOut,
  ShieldCheck,
  UserCheck,
  Pencil,
  Cloud,
  HardDrive,
  Eye,
  ClipboardList,
  ArrowUpDown,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  Settings,
} from 'lucide-react'
import {
  ACCESS_TOKEN_KEY,
  clearAuthTokens,
  fetchCategories,
  fetchCurrentUser,
  fetchPaginatedProducts,
  fetchProducts,
  fetchServerCart,
  mergeCartWithServer,
  setServerCartItemQuantity,
  toggleProductSoftDelete,
} from './services/api'
import AuthModal from './components/AuthModal'
import ProductFormModal from './components/ProductFormModal'
import ProductDetailView from './components/ProductDetailView'
import OrdersView from './components/OrdersView'
import ProductsManagementView from './components/ProductsManagementView'
import FeaturedCarousel from './components/FeaturedCarousel'
import CheckoutView from './components/CheckoutView'
import type { CartItem, Category, Product, UserProfile } from './types/store'

const GUEST_CART_STORAGE_KEY = 'novastore:cart:v1'

function loadStoredGuestCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is CartItem =>
        item &&
        typeof item === 'object' &&
        item.product &&
        typeof item.product.id === 'number' &&
        typeof item.quantity === 'number' &&
        item.quantity > 0,
    )
  } catch {
    return []
  }
}

function saveStoredGuestCart(items: CartItem[]) {
  try {
    localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Ignora caso o storage esteja indisponível
  }
}

export default function App() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(4)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [isPageTransitioning, setIsPageTransitioning] = useState<boolean>(false)
  const [apiConnected, setApiConnected] = useState<boolean>(false)
  const [cart, setCart] = useState<CartItem[]>(() => loadStoredGuestCart())
  const [cartOpen, setCartOpen] = useState<boolean>(false)
  const [syncingCart, setSyncingCart] = useState<boolean>(false)
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null)

  // Produto selecionado para a página de Detalhes do Produto
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  // Exibição da tela de Meus Pedidos / Gestão de Pedidos
  const [ordersViewOpen, setOrdersViewOpen] = useState<boolean>(false)
  // Exibição da Aba de Gestão de Produtos & Categorias (Vendedor/Admin)
  const [productsManagementOpen, setProductsManagementOpen] = useState<boolean>(false)
  // Controle do Menu em Cascata (Dropdown) "Gerenciamento" no Header
  const [managementMenuOpen, setManagementMenuOpen] = useState<boolean>(false)
  // Exibição da Página de Checkout Completa (Frete por CEP + Pagamento)
  const [checkoutViewOpen, setCheckoutViewOpen] = useState<boolean>(false)

  // Estado de Autenticação e Perfis (Vendedor/Admin vs Cliente)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false)
  const [pendingCheckoutRedirect, setPendingCheckoutRedirect] = useState<boolean>(false)

  // Modal de Cadastro/Edição de Produtos (Exclusivo Vendedor/Admin)
  const [productModalOpen, setProductModalOpen] = useState<boolean>(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // Referência para rolagem horizontal das categorias (estilo carrossel manual com wrap-around)
  const categoryScrollRef = useRef<HTMLDivElement | null>(null)

  const handleScrollCategories = (direction: 'left' | 'right') => {
    const el = categoryScrollRef.current
    if (!el) return
    const maxScrollLeft = el.scrollWidth - el.clientWidth
    if (maxScrollLeft <= 2) return

    const step = Math.max(180, Math.round(el.clientWidth * 0.55))

    if (direction === 'right') {
      // Se já chegou no final da direita, rola de volta para a extremidade oposta (início)
      if (el.scrollLeft >= maxScrollLeft - 6) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: step, behavior: 'smooth' })
      }
    } else {
      // Se já está no início da esquerda, rola até a extremidade final oposta (direita)
      if (el.scrollLeft <= 6) {
        el.scrollTo({ left: maxScrollLeft, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: -step, behavior: 'smooth' })
      }
    }
  }

  /**
   * Sincroniza o carrinho ao autenticar:
   * - Se houver itens no localStorage de visitante, faz o MERGE no banco de dados
   *   e limpa o localStorage de visitante para evitar duplicação.
   * - Caso contrário, carrega o carrinho salvo no banco de dados do usuário.
   */
  const syncHybridCartForUser = useCallback(async () => {
    setSyncingCart(true)
    try {
      const guestItems = loadStoredGuestCart()
      if (guestItems.length > 0) {
        const merged = await mergeCartWithServer(
          guestItems.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
        )
        localStorage.removeItem(GUEST_CART_STORAGE_KEY)
        setCart(merged)
      } else {
        const serverItems = await fetchServerCart()
        setCart(serverItems)
      }
    } catch {
      // Mantém estado atual em caso de erro de rede
    } finally {
      setSyncingCart(false)
    }
  }, [])

  // Carrega usuário logado caso haja token salvo ao abrir a página
  useEffect(() => {
    if (localStorage.getItem(ACCESS_TOKEN_KEY)) {
      fetchCurrentUser()
        .then((profile) => {
          setUser(profile)
          syncHybridCartForUser()
        })
        .catch(() => {
          clearAuthTokens()
          setUser(null)
        })
    }
  }, [syncHybridCartForUser])

  // Quando visitante (deslogado), persiste o carrinho no localStorage
  useEffect(() => {
    if (!user) {
      saveStoredGuestCart(cart)
    }
  }, [cart, user])

  // Sincroniza o carrinho entre múltiplas abas abertas para visitantes
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (!user && event.key === GUEST_CART_STORAGE_KEY) {
        setCart(loadStoredGuestCart())
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [user])

  const loadCategories = useCallback(() => {
    fetchCategories()
      .then((cats) => {
        setCategories(cats)
        setApiConnected(true)
      })
      .catch(() => setApiConnected(false))
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const loadFeaturedProducts = useCallback(() => {
    fetchProducts({ featured: true, page_size: 24 })
      .then((featProds) => setFeaturedProducts(featProds))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadFeaturedProducts()
  }, [loadFeaturedProducts])

  const loadCatalog = useCallback(() => {
    setIsPageTransitioning(true)
    const minTransitionDelay = new Promise((resolve) => setTimeout(resolve, 280))

    Promise.all([
      fetchPaginatedProducts({
        category__slug: selectedCategory || undefined,
        search: searchQuery || undefined,
        ordering: sortBy || undefined,
        page: currentPage,
        page_size: pageSize,
      }),
      minTransitionDelay,
    ])
      .then(([paginated]) => {
        const prods = paginated.results
        setProducts(prods)
        setTotalProductsCount(paginated.count)
        setTotalPages(paginated.total_pages ?? Math.max(1, Math.ceil(paginated.count / pageSize)))
        setApiConnected(true)
        // Se houver um produto aberto na tela de detalhes, sincroniza os dados dele também
        setSelectedProduct((prevSelected) => {
          if (!prevSelected) return null
          return prods.find((p) => p.id === prevSelected.id) ?? prevSelected
        })
        // Revalida dados de preço e estoque real do carrinho com os dados oficiais da API
        setCart((prevCart) => {
          if (prevCart.length === 0) return prevCart
          const productMap = new Map(prods.map((p) => [p.id, p]))
          return prevCart
            .map((item) => {
              const freshProduct = productMap.get(item.product.id)
              if (!freshProduct) return item
              return {
                ...item,
                product: freshProduct,
                quantity: Math.min(item.quantity, freshProduct.stock),
              }
            })
            .filter((item) => item.quantity > 0)
        })
      })
      .catch(() => {
        // Caso a página solicitada tenha ficado vazia após filtro/exclusão, volta para a página 1
        if (currentPage > 1) {
          setCurrentPage(1)
        } else {
          setApiConnected(false)
        }
      })
      .finally(() => {
        setLoading(false)
        setIsPageTransitioning(false)
      })
  }, [selectedCategory, searchQuery, sortBy, currentPage, pageSize])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog, user])

  const handleLoginSuccess = async (loggedUser: UserProfile) => {
    setUser(loggedUser)
    await syncHybridCartForUser()
    if (pendingCheckoutRedirect) {
      setPendingCheckoutRedirect(false)
      setCartOpen(false)
      setSelectedProduct(null)
      setOrdersViewOpen(false)
      setCheckoutViewOpen(true)
    }
  }

  const handleLogout = () => {
    clearAuthTokens()
    setUser(null)
    setOrdersViewOpen(false)
    setProductsManagementOpen(false)
    setManagementMenuOpen(false)
    setCheckoutViewOpen(false)
    localStorage.removeItem(GUEST_CART_STORAGE_KEY)
    setCart([])
  }

  const handleDeleteProduct = async (product: Product) => {
    const actionLabel = product.is_active ? 'desativar (Soft Delete)' : 'reativar'
    if (
      !window.confirm(
        `Deseja ${actionLabel} o produto "${product.name}" na vitrine?\n(Para exclusão permanente do banco, utilize a aba Gestão de Produtos)`,
      )
    ) {
      return
    }
    try {
      const updated = await toggleProductSoftDelete(product.id, !product.is_active)
      if (!updated.is_active) {
        setCart((prev) => prev.filter((item) => item.product.id !== product.id))
      }
      if (selectedProduct?.id === product.id) {
        setSelectedProduct(updated)
      }
      loadCatalog()
      loadFeaturedProducts()
    } catch {
      alert('Não foi possível alterar o status do produto. Verifique suas permissões.')
    }
  }

  const addToCart = async (product: Product, quantityToAdd = 1) => {
    setOrderSuccessMsg(null)
    if (product.stock <= 0) {
      alert(`O produto "${product.name}" está esgotado no momento.`)
      return
    }

    const existing = cart.find((item) => item.product.id === product.id)
    const currentQty = existing ? existing.quantity : 0

    if (currentQty >= product.stock) {
      alert(
        `Você já adicionou o limite máximo disponível em estoque (${product.stock} un.) para "${product.name}".`,
      )
      return
    }

    const nextQty = Math.min(currentQty + quantityToAdd, product.stock)

    // Atualização otimista imediata na UI respeitando o teto de estoque
    setCart((prev) => {
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, product, quantity: nextQty }
            : item,
        )
      }
      return [...prev, { product, quantity: nextQty }]
    })

    // Se logado, persiste imediatamente no banco de dados do Django
    if (user) {
      try {
        const updatedItems = await setServerCartItemQuantity(product.id, nextQty)
        setCart(updatedItems)
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { detail?: string } } }
        if (axiosErr.response?.data?.detail) {
          alert(axiosErr.response.data.detail)
        }
        loadCatalog()
      }
    }
  }

  const handleBuyNow = async (product: Product, quantityToAdd = 1) => {
    await addToCart(product, quantityToAdd)
    if (!user) {
      setPendingCheckoutRedirect(true)
      setAuthModalOpen(true)
      return
    }
    setCartOpen(false)
    setSelectedProduct(null)
    setOrdersViewOpen(false)
    setCheckoutViewOpen(true)
  }

  const updateQuantity = async (productId: number, delta: number) => {
    const existing = cart.find((item) => item.product.id === productId)
    if (!existing) return
    const maxStock = existing.product.stock
    const nextQty = Math.min(maxStock, Math.max(0, existing.quantity + delta))

    if (delta > 0 && existing.quantity >= maxStock) {
      return
    }

    // Atualização otimista na UI
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: nextQty } : item,
        )
        .filter((item) => item.quantity > 0),
    )

    if (user) {
      try {
        const updatedItems = await setServerCartItemQuantity(productId, nextQty)
        setCart(updatedItems)
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { detail?: string } } }
        if (axiosErr.response?.data?.detail) {
          alert(axiosErr.response.data.detail)
        }
        loadCatalog()
      }
    }
  }

  const handleCheckout = () => {
    if (!user) {
      setCartOpen(false)
      setPendingCheckoutRedirect(true)
      setAuthModalOpen(true)
      return
    }
    setCartOpen(false)
    setSelectedProduct(null)
    setOrdersViewOpen(false)
    setCheckoutViewOpen(true)
  }

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart],
  )

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (acc, item) => acc + Number(item.product.price) * item.quantity,
        0,
      ),
    [cart],
  )

  const formatBRL = (value: number | string) =>
    Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div
            onClick={() => {
              setSelectedProduct(null)
              setOrdersViewOpen(false)
              setProductsManagementOpen(false)
              setManagementMenuOpen(false)
              setCheckoutViewOpen(false)
            }}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900">
                NovaStore
              </span>
              <span className="hidden md:inline-flex items-center gap-1 ml-3 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {apiConnected ? 'Django API Online' : 'Conectando API...'}
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
                if (selectedProduct) setSelectedProduct(null)
                if (ordersViewOpen) setOrdersViewOpen(false)
                if (productsManagementOpen) setProductsManagementOpen(false)
              }}
              placeholder="Buscar produtos, categorias..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-slate-100/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Actions: User Auth + Gerenciamento/Pedidos + Cart */}
          <div className="flex items-center gap-2.5">
            {user && !user.is_seller && (
              <button
                onClick={() => {
                  setSelectedProduct(null)
                  setCheckoutViewOpen(false)
                  setProductsManagementOpen(false)
                  setOrdersViewOpen((prev) => !prev)
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium transition cursor-pointer ${
                  ordersViewOpen
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">Meus Pedidos</span>
              </button>
            )}

            {/* Menu em Cascata "Gerenciamento" exclusivo para Vendedor / Admin */}
            {user?.is_seller && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setManagementMenuOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition cursor-pointer ${
                    ordersViewOpen || productsManagementOpen || managementMenuOpen
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Gerenciamento</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      managementMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Div em Cascata (Dropdown Menu) */}
                {managementMenuOpen && (
                  <>
                    <div
                      onClick={() => setManagementMenuOpen(false)}
                      className="fixed inset-0 z-30"
                    />
                    <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-40 catalog-card-enter">
                      <div className="px-3.5 py-2 border-b border-slate-100">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Painel do Vendedor
                        </p>
                        <p className="text-xs font-semibold text-slate-700 truncate">
                          Logado como {user.username}
                        </p>
                      </div>

                      <div className="p-1.5 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setManagementMenuOpen(false)
                            setSelectedProduct(null)
                            setCheckoutViewOpen(false)
                            setProductsManagementOpen(false)
                            setOrdersViewOpen(true)
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer text-left ${
                            ordersViewOpen
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <ClipboardList className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div>
                            <div className="font-bold">Gestão de Pedidos</div>
                            <div className="text-[11px] font-normal text-slate-500">
                              Acompanhar e atualizar status
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setManagementMenuOpen(false)
                            setSelectedProduct(null)
                            setCheckoutViewOpen(false)
                            setOrdersViewOpen(false)
                            setProductsManagementOpen(true)
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer text-left ${
                            productsManagementOpen
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Package className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div>
                            <div className="font-bold">Gestão de Produtos</div>
                            <div className="text-[11px] font-normal text-slate-500">
                              Catálogo, estoque e categorias
                            </div>
                          </div>
                        </button>

                        <div className="my-1 border-t border-slate-100" />

                        <button
                          type="button"
                          onClick={() => {
                            setManagementMenuOpen(false)
                            setEditingProduct(null)
                            setProductModalOpen(true)
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-amber-800 bg-amber-50/80 hover:bg-amber-100 transition cursor-pointer text-left"
                        >
                          <Plus className="w-4 h-4 text-amber-600 shrink-0" />
                          <div>
                            <div className="font-bold">Novo Produto</div>
                            <div className="text-[11px] font-normal text-amber-700">
                              Cadastrar produto ou categoria
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-2 bg-slate-100 pl-3 pr-2 py-1.5 rounded-xl border border-slate-200">
                {user.is_seller ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    Vendedor
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Cliente
                  </span>
                )}
                <span className="text-xs font-semibold text-slate-800 hidden sm:inline">
                  {user.first_name || user.username}
                </span>
                <button
                  onClick={handleLogout}
                  title="Sair da conta"
                  className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-white transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium hover:bg-slate-100 transition cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-indigo-600" />
                <span>Entrar</span>
              </button>
            )}

            <button
              onClick={() => setCartOpen(true)}
              className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Carrinho</span>
              {cartCount > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-500 text-white font-semibold">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Renderização Condicional: Checkout OU Gestão de Produtos OU Pedidos OU Detalhes do Produto OU Vitrine Principal */}
      {checkoutViewOpen && user ? (
        <CheckoutView
          user={user}
          cart={cart}
          onBackToStore={() => setCheckoutViewOpen(false)}
          onOrderSuccess={(createdOrder) => {
            setCart([])
            setOrderSuccessMsg(
              `Pedido #${createdOrder.id} realizado com sucesso! Total: ${formatBRL(createdOrder.total_amount)}`,
            )
            loadCatalog()
            setCheckoutViewOpen(false)
            setOrdersViewOpen(true)
          }}
        />
      ) : productsManagementOpen && user?.is_seller ? (
        <ProductsManagementView
          categories={categories}
          onBack={() => setProductsManagementOpen(false)}
          onOpenNewProduct={() => {
            setEditingProduct(null)
            setProductModalOpen(true)
          }}
          onEditProduct={(prod) => {
            setEditingProduct(prod)
            setProductModalOpen(true)
          }}
          onProductRemovedFromStore={(prodId) => {
            setCart((prev) => prev.filter((item) => item.product.id !== prodId))
            if (selectedProduct?.id === prodId) {
              setSelectedProduct(null)
            }
          }}
          onViewProduct={(prod) => {
            setProductsManagementOpen(false)
            setSelectedProduct(prod)
          }}
          onCategoriesRefresh={() => {
            loadCategories()
            loadCatalog()
            loadFeaturedProducts()
          }}
        />
      ) : ordersViewOpen && user ? (
        <OrdersView
          user={user}
          onBack={() => setOrdersViewOpen(false)}
          onCatalogRefresh={loadCatalog}
        />
      ) : selectedProduct ? (
        <ProductDetailView
          initialProduct={selectedProduct}
          allProducts={products}
          categories={categories}
          user={user}
          onBack={() => setSelectedProduct(null)}
          onSelectCategory={(catSlug) => {
            setSelectedCategory(catSlug)
            setCurrentPage(1)
            setSelectedProduct(null)
          }}
          onSelectProduct={(prod) => setSelectedProduct(prod)}
          onAddToCart={(prod, qty) => addToCart(prod, qty)}
          onBuyNow={(prod, qty) => handleBuyNow(prod, qty)}
          onEditProduct={(prod) => {
            setEditingProduct(prod)
            setProductModalOpen(true)
          }}
          onDeleteProduct={(prod) => handleDeleteProduct(prod)}
          onOpenAuth={() => setAuthModalOpen(true)}
          onCatalogRefresh={loadCatalog}
        />
      ) : (
        <>
          {/* Hero Banner */}
          <section className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium backdrop-blur-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Django REST Framework + JWT + Carrinho Híbrido</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  Seu E-commerce Full-Stack pronto para escalar
                </h1>
                <p className="text-indigo-100 text-sm sm:text-base">
                  Catálogo integrado à API Django com autenticação JWT, controle de
                  permissões por grupos, página de detalhes do produto e Carrinho Híbrido.
                </p>
              </div>
            </div>
          </section>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8">
            {/* Barra de Categorias (Rolagem Horizontal com Wrap-Around) + Seletor de Ordenação e Limite por Página */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Container de Categorias isolado com min-w-0 e botões < > para nunca empurrar os seletores da direita */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => handleScrollCategories('left')}
                  title="Rolar categorias para a esquerda"
                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-indigo-600 shrink-0 shadow-2xs transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div
                  ref={categoryScrollRef}
                  className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5 min-w-0 flex-1"
                >
                  <button
                    onClick={() => {
                      setSelectedCategory('')
                      setCurrentPage(1)
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
                      selectedCategory === ''
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Todos os Produtos
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.slug)
                        setCurrentPage(1)
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
                        selectedCategory === cat.slug
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleScrollCategories('right')}
                  title="Rolar categorias para a direita"
                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-indigo-600 shrink-0 shadow-2xs transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Limite de Produtos por Página + Ordenação (Fixos à direita com shrink-0) */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    aria-label="Quantidade de produtos por página"
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value={4}>Exibir: 4 por página</option>
                    <option value={8}>Exibir: 8 por página</option>
                    <option value={12}>Exibir: 12 por página</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-4 h-4 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">Ordenar por: Destaques</option>
                    <option value="price">Menor Preço</option>
                    <option value="-price">Maior Preço</option>
                    <option value="name">Nome (A–Z)</option>
                    <option value="-created_at">Mais Recentes</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Carrossel de Banners Verticais de Produtos em Destaque (Estilo Amazon) */}
            {!searchQuery && (
              <FeaturedCarousel
                products={featuredProducts.length > 0 ? featuredProducts : products}
                onSelectProduct={(prod) => setSelectedProduct(prod)}
                onAddToCart={(prod) => addToCart(prod, 1)}
              />
            )}

            {/* Título da Grade de Catálogo */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
              <h2 className="text-lg font-extrabold text-slate-900">
                {selectedCategory
                  ? `Catálogo: ${categories.find((c) => c.slug === selectedCategory)?.name || ''}`
                  : searchQuery
                    ? `Resultados para "${searchQuery}"`
                    : 'Catálogo Completo'}
              </h2>
              <span className="text-xs font-medium text-slate-500">
                Exibindo {products.length} de {totalProductsCount} produto(s) • Página{' '}
                {currentPage} de {totalPages}
              </span>
            </div>

            {/* Product Grid com Transição Suave via GPU (opacity + transform) */}
            {loading && products.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="bg-white rounded-2xl border border-slate-200 p-4 h-80 animate-pulse flex flex-col justify-between"
                  >
                    <div className="bg-slate-200 h-44 rounded-xl" />
                    <div className="space-y-2">
                      <div className="bg-slate-200 h-4 w-2/3 rounded" />
                      <div className="bg-slate-200 h-4 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                <Package className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-lg font-semibold text-slate-800">
                  Nenhum produto encontrado
                </h3>
                <p className="text-sm text-slate-500">
                  Tente ajustar sua busca ou selecionar outra categoria.
                </p>
              </div>
            ) : (
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 transition-all duration-300 ease-in-out ${
                  isPageTransitioning
                    ? 'opacity-20 translate-y-1.5 scale-[0.985] pointer-events-none'
                    : 'opacity-100 translate-y-0 scale-100'
                }`}
              >
                {products.map((product, idx) => (
                  <article
                    key={`${currentPage}-${pageSize}-${product.id}`}
                    style={{ animationDelay: `${idx * 65}ms` }}
                    className={`catalog-card-enter group bg-white rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition flex flex-col ${
                      product.is_active ? 'border-slate-200' : 'border-rose-300 opacity-75'
                    }`}
                  >
                    <div
                      onClick={() => setSelectedProduct(product)}
                      className="relative h-48 bg-slate-100 overflow-hidden cursor-pointer"
                    >
                      {product.image_url || product.image ? (
                        <img
                          src={product.image || product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Package className="w-10 h-10" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 backdrop-blur text-slate-700">
                          {product.category_name}
                        </span>
                        {!product.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-600 text-white">
                            Oculto
                          </span>
                        )}
                      </div>

                      {/* Ações de Edição/Exclusão exclusivas do Vendedor/Admin */}
                      {user?.is_seller && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-3 right-3 flex items-center gap-1.5"
                        >
                          <button
                            onClick={() => {
                              setEditingProduct(product)
                              setProductModalOpen(true)
                            }}
                            title="Editar produto"
                            className="p-2 rounded-xl bg-white/90 backdrop-blur text-slate-700 hover:bg-indigo-600 hover:text-white shadow-xs transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product)}
                            title="Excluir produto"
                            className="p-2 rounded-xl bg-white/90 backdrop-blur text-rose-600 hover:bg-rose-600 hover:text-white shadow-xs transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                      <div
                        onClick={() => setSelectedProduct(product)}
                        className="space-y-1.5 cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="font-semibold text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition">
                            {product.name}
                          </h2>
                          {(product.reviews_count ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 shrink-0">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              {Number(product.average_rating ?? 0).toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {product.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-xs text-slate-400 block">
                            Estoque: {product.stock} un.
                          </span>
                          <span className="text-lg font-bold text-slate-900">
                            {formatBRL(product.price)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedProduct(product)}
                            title="Ver detalhes do produto"
                            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => addToCart(product, 1)}
                            disabled={product.stock <= 0}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            {product.stock > 0 ? 'Adicionar' : 'Esgotado'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Barra de Paginação Customizada (CatalogPagination DRF) */}
            {!loading && totalProductsCount > 0 && (
              <div className="pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  Mostrando{' '}
                  <strong className="text-slate-800">
                    {(currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  a{' '}
                  <strong className="text-slate-800">
                    {Math.min(currentPage * pageSize, totalProductsCount)}
                  </strong>{' '}
                  de <strong className="text-slate-800">{totalProductsCount}</strong>{' '}
                  produtos
                </div>

                {totalPages > 1 && (
                  <nav
                    aria-label="Paginação do catálogo"
                    className="inline-flex items-center gap-1.5"
                  >
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </button>

                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
                      (pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer ${
                            pageNum === currentPage
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ),
                    )}

                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      Próxima
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </nav>
                )}
              </div>
            )}
          </main>
        </>
      )}

      {/* Rodapé Compacto Ancorado no Fim da Página (mt-auto no flex-col) */}
      <footer className="mt-auto bg-slate-900 text-slate-300 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
            {/* Coluna 1: Sobre a NovaStore */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">
                Sobre a NovaStore
              </h3>
              <ul className="space-y-1 text-slate-400">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(null)
                      setOrdersViewOpen(false)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="hover:text-white transition cursor-pointer"
                  >
                    Quem somos
                  </button>
                </li>
                <li>
                  <span className="hover:text-white transition cursor-pointer">
                    Trabalhe conosco
                  </span>
                </li>
                <li>
                  <span className="hover:text-white transition cursor-pointer">
                    Sustentabilidade & Segurança
                  </span>
                </li>
              </ul>
            </div>

            {/* Coluna 2: Se torne um vendedor */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">
                Se torne um vendedor
              </h3>
              <ul className="space-y-1 text-slate-400">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      if (user?.is_seller) {
                        setEditingProduct(null)
                        setProductModalOpen(true)
                      } else {
                        setAuthModalOpen(true)
                      }
                    }}
                    className="hover:text-amber-300 transition cursor-pointer text-left"
                  >
                    Venda na NovaStore
                  </button>
                </li>
                <li>
                  <span className="hover:text-white transition cursor-pointer">
                    Portal do Parceiro
                  </span>
                </li>
                <li>
                  <span className="hover:text-white transition cursor-pointer">
                    Logística & Envio Full
                  </span>
                </li>
              </ul>
            </div>

            {/* Coluna 3: Sua conta */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">
                Sua conta
              </h3>
              <ul className="space-y-1 text-slate-400">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      if (user) {
                        setSelectedProduct(null)
                        setOrdersViewOpen(true)
                      } else {
                        setAuthModalOpen(true)
                      }
                    }}
                    className="hover:text-white transition cursor-pointer text-left"
                  >
                    {user ? 'Meus Pedidos' : 'Entrar ou Cadastrar'}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setCartOpen(true)}
                    className="hover:text-white transition cursor-pointer text-left"
                  >
                    Seu Carrinho ({cartCount})
                  </button>
                </li>
                {user && (
                  <li>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="hover:text-rose-400 transition cursor-pointer text-left"
                    >
                      Sair da conta
                    </button>
                  </li>
                )}
              </ul>
            </div>

            {/* Coluna 4: Ajuda */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">
                Ajuda
              </h3>
              <ul className="space-y-1 text-slate-400">
                <li>
                  <span className="hover:text-white transition cursor-pointer">
                    Prazos e Entregas
                  </span>
                </li>
                <li>
                  <span className="hover:text-white transition cursor-pointer">
                    Trocas e Devoluções
                  </span>
                </li>
                <li>
                  <span className="hover:text-white transition cursor-pointer">
                    Central de Atendimento
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Linha inferior super compacta */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold text-slate-300">NovaStore</span>
              <span>• E-commerce Full-Stack (Django + React + TypeScript)</span>
            </div>
            <span>© {new Date().getFullYear()} NovaStore. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>

      {/* Modal de Login / Cadastro */}
      <AuthModal
        isOpen={authModalOpen}
        checkoutRedirectMessage={pendingCheckoutRedirect}
        onClose={() => {
          setAuthModalOpen(false)
          setPendingCheckoutRedirect(false)
        }}
        onSuccess={handleLoginSuccess}
      />

      {/* Modal de Criação / Edição de Produto (Vendedor / Admin) */}
      <ProductFormModal
        isOpen={productModalOpen}
        categories={categories}
        editingProduct={editingProduct}
        onClose={() => setProductModalOpen(false)}
        onCategoryCreated={(newCat) => {
          setCategories((prev) => [...prev, newCat])
        }}
        onSaved={() => {
          loadCatalog()
          loadFeaturedProducts()
          loadCategories()
        }}
      />

      {/* Cart Drawer com Transição Suave (Slide-over + Backdrop Fade) */}
      <div
        aria-hidden={!cartOpen}
        className={`fixed inset-0 z-50 flex justify-end transition-all duration-300 ${
          cartOpen ? 'pointer-events-auto visible' : 'pointer-events-none invisible'
        }`}
      >
        {/* Backdrop escuro com fade suave (clicar fora fecha a gaveta) */}
        <div
          onClick={() => setCartOpen(false)}
          className={`fixed inset-0 bg-slate-900/45 backdrop-blur-xs transition-opacity duration-300 ease-out ${
            cartOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Painel lateral deslizante da direita para a esquerda */}
        <div
          className={`relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between transform transition-transform duration-300 ease-out ${
            cartOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-5 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-lg text-slate-900">
                  Seu Carrinho ({cartCount})
                </h2>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status do Carrinho Híbrido */}
            {user ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                <Cloud className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>
                  {syncingCart
                    ? 'Sincronizando carrinho com sua conta...'
                    : `Sincronizado na conta de ${user.first_name || user.username} (multi-dispositivo)`}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 text-xs text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 shrink-0 text-slate-500" />
                  <span>Salvo neste navegador (localStorage)</span>
                </div>
                <button
                  onClick={() => {
                    setCartOpen(false)
                    setAuthModalOpen(true)
                  }}
                  className="font-semibold text-indigo-600 hover:underline cursor-pointer"
                >
                  Entrar para sincronizar
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {orderSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{orderSuccessMsg}</span>
                </div>
                <button
                  onClick={() => {
                    setCartOpen(false)
                    setSelectedProduct(null)
                    setOrdersViewOpen(true)
                  }}
                  className="inline-flex items-center gap-1 text-emerald-900 font-bold underline cursor-pointer"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Ver histórico em {user?.is_seller ? 'Gestão de Pedidos' : 'Meus Pedidos'}
                </button>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-500">Seu carrinho está vazio.</p>
              </div>
            ) : (
              cart.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200"
                >
                  <div
                    onClick={() => {
                      setSelectedProduct(product)
                      setCartOpen(false)
                    }}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <h4 className="text-sm font-semibold text-slate-900 hover:text-indigo-600 truncate">
                      {product.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {formatBRL(product.price)} cada • Disp: {product.stock} un.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(product.id, -1)}
                      className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer"
                    >
                      {quantity === 1 ? (
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      ) : (
                        <Minus className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="text-sm font-medium w-6 text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(product.id, 1)}
                      disabled={quantity >= product.stock}
                      title={
                        quantity >= product.stock
                          ? `Limite de estoque atingido (${product.stock} un.)`
                          : 'Aumentar quantidade'
                      }
                      className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-5 border-t border-slate-200 space-y-4 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total</span>
              <span className="text-xl font-bold text-slate-900">
                {formatBRL(cartTotal)}
              </span>
            </div>
            <button
              disabled={cart.length === 0}
              onClick={handleCheckout}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer"
            >
              {user ? 'Ir para o Checkout' : 'Entrar e Finalizar Pedido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
