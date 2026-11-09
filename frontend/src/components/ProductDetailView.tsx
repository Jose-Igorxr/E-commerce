import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  ShoppingBag,
  Plus,
  Minus,
  Check,
  ShieldCheck,
  Truck,
  RotateCcw,
  Package,
  Sparkles,
  Pencil,
  Trash2,
  Star,
  MessageSquarePlus,
  LogIn,
  UserCheck,
} from 'lucide-react'
import {
  createProductReview,
  deleteProductReview,
  fetchProductById,
  fetchProductReviews,
} from '../services/api'
import type { Category, Product, ReviewItem, UserProfile } from '../types/store'

interface ProductDetailViewProps {
  initialProduct: Product
  allProducts: Product[]
  categories: Category[]
  user: UserProfile | null
  onBack: () => void
  onSelectCategory: (categorySlug: string) => void
  onSelectProduct: (product: Product) => void
  onAddToCart: (product: Product, quantity: number) => void
  onBuyNow: (product: Product, quantity: number) => void
  onEditProduct: (product: Product) => void
  onDeleteProduct: (product: Product) => void
  onOpenAuth: () => void
  onCatalogRefresh: () => void
}

export default function ProductDetailView({
  initialProduct,
  allProducts,
  categories,
  user,
  onBack,
  onSelectCategory,
  onSelectProduct,
  onAddToCart,
  onBuyNow,
  onEditProduct,
  onDeleteProduct,
  onOpenAuth,
  onCatalogRefresh,
}: ProductDetailViewProps) {
  const [product, setProduct] = useState<Product>(initialProduct)
  const [quantity, setQuantity] = useState<number>(1)
  const [addedFeedback, setAddedFeedback] = useState<boolean>(false)

  // Estado de Avaliações e Comentários
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loadingReviews, setLoadingReviews] = useState<boolean>(true)
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [comment, setComment] = useState<string>('')
  const [submittingReview, setSubmittingReview] = useState<boolean>(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const isSeller = Boolean(user?.is_seller)
  const myExistingReview = reviews.find((r) => user && r.user === user.id) ?? null

  const loadProductAndReviews = useCallback((prodId: number) => {
    fetchProductById(prodId)
      .then((fresh) => setProduct(fresh))
      .catch(() => {})

    setLoadingReviews(true)
    fetchProductReviews(prodId)
      .then((revs) => setReviews(revs))
      .catch(() => setReviews([]))
      .finally(() => setLoadingReviews(false))
  }, [])

  useEffect(() => {
    setProduct(initialProduct)
    setQuantity(1)
    setAddedFeedback(false)
    setComment('')
    setRating(5)
    setReviewError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })

    loadProductAndReviews(initialProduct.id)
  }, [initialProduct, loadProductAndReviews])

  // Se o cliente logado já possui um comentário neste produto, preenche os campos para edição
  useEffect(() => {
    if (myExistingReview) {
      setRating(myExistingReview.rating)
      setComment(myExistingReview.comment)
    } else {
      setRating(5)
      setComment('')
    }
  }, [myExistingReview])

  const categoryObj = categories.find((c) => c.id === product.category)

  const relatedProducts = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id && p.is_active)
    .slice(0, 4)

  const formatBRL = (value: number | string) =>
    Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

  const installmentValue = Number(product.price) / 10

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
      : (product.average_rating ?? 0)

  const handleAddClick = () => {
    if (product.stock <= 0) return
    onAddToCart(product, quantity)
    setAddedFeedback(true)
    setTimeout(() => setAddedFeedback(false), 2000)
  }

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) {
      onOpenAuth()
      return
    }
    if (!comment.trim()) {
      setReviewError('Escreva um comentário sobre o produto.')
      return
    }

    setSubmittingReview(true)
    setReviewError(null)
    try {
      const savedReview = await createProductReview(product.id, {
        rating,
        comment: comment.trim(),
      })
      setReviews((prev) => {
        const exists = prev.some((r) => r.id === savedReview.id || r.user === savedReview.user)
        if (exists) {
          return prev.map((r) =>
            r.id === savedReview.id || r.user === savedReview.user ? savedReview : r,
          )
        }
        return [savedReview, ...prev]
      })
      onCatalogRefresh()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setReviewError(
        axiosErr.response?.data?.detail ||
          'Não foi possível enviar sua avaliação. Verifique se o pedido já consta como Entregue.',
      )
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleDeleteReview = async (reviewId: number) => {
    if (!window.confirm('Deseja realmente excluir este comentário?')) return
    try {
      await deleteProductReview(product.id, reviewId)
      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
      onCatalogRefresh()
    } catch {
      alert('Não foi possível excluir o comentário.')
    }
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-10">
      {/* Topo: Botão Voltar + Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-500 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a vitrine
          </button>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          {categoryObj && (
            <>
              <button
                onClick={() => onSelectCategory(categoryObj.slug)}
                className="hover:text-slate-900 transition cursor-pointer"
              >
                {categoryObj.name}
              </button>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </>
          )}
          <span className="text-slate-800 font-medium truncate max-w-xs">
            {product.name}
          </span>
        </nav>

        {/* Ações rápidas do Vendedor/Admin */}
        {isSeller && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditProduct(product)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar Produto
            </button>
            <button
              onClick={() => onDeleteProduct(product)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-600 hover:text-white transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir Produto
            </button>
          </div>
        )}
      </div>

      {/* Card Principal do Produto */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Coluna da Imagem */}
        <div className="lg:col-span-6 bg-slate-100 relative min-h-80 sm:min-h-96 flex items-center justify-center overflow-hidden">
          {product.image || product.image_url ? (
            <img
              src={product.image || product.image_url}
              alt={product.name}
              className="w-full h-full max-h-[500px] object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 py-20 gap-2">
              <Package className="w-16 h-16" />
              <span className="text-xs">Sem imagem cadastrada</span>
            </div>
          )}

          <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/95 backdrop-blur text-slate-800 shadow-xs">
              {product.category_name}
            </span>
            {product.featured && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-400 text-slate-950 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
                Destaque
              </span>
            )}
            {!product.is_active && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-600 text-white shadow-xs">
                Oculto para clientes
              </span>
            )}
          </div>
        </div>

        {/* Coluna de Informações e Compra */}
        <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span>Ref / Slug: {product.slug}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full font-semibold ${
                  product.stock > 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {product.stock > 0
                  ? `${product.stock} unidades em estoque`
                  : 'Produto esgotado'}
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {product.name}
              </h1>

              {/* Resumo de Estrelas logo abaixo do título */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= Math.round(averageRating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-bold text-slate-800">
                  {reviews.length > 0 ? averageRating.toFixed(1) : 'Novo'}
                </span>
                <span className="text-xs text-slate-400">
                  ({reviews.length} {reviews.length === 1 ? 'avaliação' : 'avaliações'})
                </span>
              </div>
            </div>

            {/* Preço e Parcelamento */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-xs font-medium text-slate-500 block">
                Preço à vista
              </span>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-indigo-600">
                  {formatBRL(product.price)}
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  5% OFF no PIX
                </span>
              </div>
              <p className="text-xs text-slate-500">
                ou em até <strong>10x de {formatBRL(installmentValue)}</strong> sem
                juros no cartão
              </p>
            </div>

            {/* Descrição Completa */}
            <div className="space-y-2 pt-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Sobre o produto
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {product.description ||
                  'Este produto conta com garantia oficial e especificações de alto desempenho.'}
              </p>
            </div>
          </div>

          {/* Controles de Quantidade + Botões de Compra */}
          <div className="space-y-5 pt-4 border-t border-slate-100">
            {product.stock > 0 && (
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-slate-700">
                  Quantidade:
                </span>
                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="p-2 rounded-lg text-slate-700 hover:bg-white disabled:opacity-40 transition cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-slate-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    disabled={quantity >= product.stock}
                    className="p-2 rounded-lg text-slate-700 hover:bg-white disabled:opacity-40 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs text-slate-400">
                  Subtotal: <strong>{formatBRL(Number(product.price) * quantity)}</strong>
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={handleAddClick}
                className={`py-3.5 px-5 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer ${
                  addedFeedback
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                } disabled:opacity-50`}
              >
                {addedFeedback ? (
                  <>
                    <Check className="w-4 h-4" />
                    Adicionado ao Carrinho!
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    Adicionar ao Carrinho
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={() => onBuyNow(product, quantity)}
                className="py-3.5 px-5 rounded-xl bg-indigo-600 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-indigo-500 shadow-sm disabled:opacity-50 transition cursor-pointer"
              >
                Comprar Agora
              </button>
            </div>

            {/* Garantias e Benefícios */}
            <div className="grid grid-cols-3 gap-3 pt-2 text-xs text-slate-600">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                <Truck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Envio imediato para todo o Brasil</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Garantia oficial de 12 meses</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                <RotateCcw className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Devolução grátis em até 7 dias</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Avaliações e Comentários de Clientes */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-indigo-600" />
              Avaliações e Comentários sobre o Produto
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Opiniões reais de clientes que avaliaram {product.name}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-200/80">
            <div className="text-center">
              <span className="text-3xl font-extrabold text-slate-900 block leading-none">
                {reviews.length > 0 ? averageRating.toFixed(1) : '—'}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">de 5.0</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(averageRating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs font-medium text-slate-500">
                Baseado em {reviews.length}{' '}
                {reviews.length === 1 ? 'avaliação' : 'avaliações'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Coluna Esquerda: Formulário de Avaliação (Exclusivo pós-entrega) */}
          <div className="lg:col-span-5">
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                {myExistingReview
                  ? 'Atualizar sua avaliação'
                  : 'Deixe sua avaliação'}
              </h3>

              {!user ? (
                <div className="space-y-3 py-2">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Faça login na sua conta para avaliar os produtos que você já
                    comprou e recebeu.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    Entrar para avaliar
                  </button>
                </div>
              ) : !product.user_can_review ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5 leading-relaxed">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    Avaliação protegida contra reviews falsos
                  </p>
                  <p className="text-amber-800">
                    Para garantir opiniões 100% autênticas, apenas clientes que
                    compraram este produto e tiveram a entrega confirmada (status{' '}
                    <strong>Entregue</strong> em Meus Pedidos) podem publicar uma
                    avaliação.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  {myExistingReview && (
                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs">
                      Você já avaliou este produto. Enviar novamente atualizará a sua
                      nota e comentário atuais.
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Sua nota para este produto:
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const active = star <= (hoverRating || rating)
                        return (
                          <button
                            key={star}
                            type="button"
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setRating(star)}
                            className="p-1 rounded-lg hover:bg-white transition cursor-pointer"
                          >
                            <Star
                              className={`w-6 h-6 transition ${
                                active
                                  ? 'fill-amber-400 text-amber-400 scale-105'
                                  : 'text-slate-300'
                              }`}
                            />
                          </button>
                        )
                      })}
                      <span className="ml-2 text-xs font-bold text-slate-700">
                        {rating} de 5 estrelas
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Seu comentário ({user.first_name || user.username}):
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Conte o que achou da qualidade, desempenho e custo-benefício do produto..."
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {reviewError && (
                    <p className="text-xs font-medium text-rose-600">{reviewError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer"
                  >
                    {submittingReview
                      ? 'Salvando...'
                      : myExistingReview
                        ? 'Atualizar Minha Avaliação'
                        : 'Publicar Avaliação'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Coluna Direita: Lista de Comentários */}
          <div className="lg:col-span-7 space-y-4">
            {loadingReviews ? (
              <div className="space-y-3">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="h-24 rounded-2xl bg-slate-100 animate-pulse"
                  />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <Star className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-800">
                  Este produto ainda não possui comentários
                </h4>
                <p className="text-xs text-slate-500">
                  Seja o primeiro a avaliar e ajudar outros compradores!
                </p>
              </div>
            ) : (
              reviews.map((rev) => {
                const canDelete =
                  user && (user.id === rev.user || user.is_seller)

                return (
                  <article
                    key={rev.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {rev.user_name}
                          </span>
                          {rev.is_seller ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800">
                              <ShieldCheck className="w-3 h-3 text-amber-600" />
                              Vendedor Oficial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700">
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              Cliente Verificado
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            • {formatDate(rev.created_at)}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3.5 h-3.5 ${
                                star <= rev.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(rev.id)}
                          title="Excluir comentário"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                      {rev.comment}
                    </p>
                  </article>
                )
              })
            )}
          </div>
        </div>
      </section>

      {/* Produtos Relacionados da Mesma Categoria */}
      {relatedProducts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Produtos relacionados em {product.category_name}
            </h2>
            <button
              onClick={onBack}
              className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
            >
              Ver catálogo completo
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((rel) => (
              <article
                key={rel.id}
                onClick={() => onSelectProduct(rel)}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col cursor-pointer"
              >
                <div className="relative h-40 bg-slate-100 overflow-hidden">
                  {rel.image || rel.image_url ? (
                    <img
                      src={rel.image || rel.image_url}
                      alt={rel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Package className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <h3 className="font-semibold text-sm text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition">
                    {rel.name}
                  </h3>
                  <span className="text-base font-bold text-slate-900">
                    {formatBRL(rel.price)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
