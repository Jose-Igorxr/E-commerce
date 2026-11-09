import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  ArrowUpRight,
  ShoppingBag,
  Sparkles,
  Star,
} from 'lucide-react'
import type { Product } from '../types/store'

interface FeaturedCarouselProps {
  products: Product[]
  onSelectProduct: (product: Product) => void
  onAddToCart: (product: Product) => void
}

const BANNER_THEMES = [
  {
    badge: 'Oferta Relâmpago',
    accent: 'from-indigo-950/95 via-indigo-900/60 to-transparent',
    pill: 'bg-amber-400 text-slate-950',
  },
  {
    badge: 'Mais Vendido',
    accent: 'from-slate-950/95 via-slate-900/60 to-transparent',
    pill: 'bg-emerald-400 text-slate-950',
  },
  {
    badge: 'Escolha NovaStore',
    accent: 'from-violet-950/95 via-violet-900/60 to-transparent',
    pill: 'bg-sky-400 text-slate-950',
  },
  {
    badge: 'Destaque da Semana',
    accent: 'from-rose-950/95 via-rose-900/60 to-transparent',
    pill: 'bg-amber-300 text-slate-950',
  },
]

export default function FeaturedCarousel({
  products,
  onSelectProduct,
  onAddToCart,
}: FeaturedCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const isJumpingRef = useRef(false)
  const [isPaused, setIsPaused] = useState(false)

  // Seleciona produtos marcados como featured (ou usa os primeiros ativos)
  const baseProducts = useMemo(() => {
    const featured = products.filter((p) => p.featured && p.is_active)
    return featured.length > 0
      ? featured
      : products.filter((p) => p.is_active).slice(0, 6)
  }, [products])

  // Triplica os itens [Clones Esquerda, Bloco Central, Clones Direita]
  // para permitir rolagem infinita contínua nos dois sentidos
  const infiniteProducts = useMemo(() => {
    if (baseProducts.length === 0) return []
    return [...baseProducts, ...baseProducts, ...baseProducts]
  }, [baseProducts])

  // Posiciona inicialmente no bloco central
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || baseProducts.length === 0) return

    const initScroll = () => {
      const singleSetWidth = container.scrollWidth / 3
      if (singleSetWidth > 0) {
        container.scrollLeft = singleSetWidth
      }
    }

    const frame = requestAnimationFrame(initScroll)
    return () => cancelAnimationFrame(frame)
  }, [baseProducts.length])

  // Reposiciona de forma invisível quando atinge o início do 1º bloco ou o início do 3º bloco
  const handleInfiniteScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container || isJumpingRef.current || baseProducts.length === 0) return

    const singleSetWidth = container.scrollWidth / 3
    if (singleSetWidth <= 0) return

    if (container.scrollLeft <= 16) {
      isJumpingRef.current = true
      container.scrollLeft += singleSetWidth
      requestAnimationFrame(() => {
        isJumpingRef.current = false
      })
    } else if (container.scrollLeft >= singleSetWidth * 2 - 16) {
      isJumpingRef.current = true
      container.scrollLeft -= singleSetWidth
      requestAnimationFrame(() => {
        isJumpingRef.current = false
      })
    }
  }, [baseProducts.length])

  const scrollOneCard = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return
    const firstCard = container.firstElementChild as HTMLElement | null
    const step = firstCard ? firstCard.offsetWidth + 16 : 304
    container.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    })
  }, [])

  // Rolagem automática contínua (pausa quando o usuário passa o mouse)
  useEffect(() => {
    if (isPaused || baseProducts.length <= 1) return
    const timer = setInterval(() => {
      scrollOneCard('right')
    }, 3800)
    return () => clearInterval(timer)
  }, [isPaused, baseProducts.length, scrollOneCard])

  if (baseProducts.length === 0) return null

  const formatBRL = (value: number | string) =>
    Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

  return (
    <section
      className="space-y-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Cabeçalho da Seção de Banners em Destaque */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600">
            <Flame className="w-4 h-4 fill-amber-500" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Destaques & Ofertas Especiais
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Sparkles className="w-3 h-3" />
                Carrossel Infinito
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Clique em qualquer banner para abrir os detalhes e avaliações do produto
            </p>
          </div>
        </div>

        {/* Setas de Navegação do Carrossel Infinito */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollOneCard('left')}
            title="Anterior"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollOneCard('right')}
            title="Próximo"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Carrossel Horizontal Infinito de Banners Verticais */}
      <div
        ref={scrollContainerRef}
        onScroll={handleInfiniteScroll}
        className="flex items-stretch gap-4 overflow-x-auto pb-3 select-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {infiniteProducts.map((product, idx) => {
          const originalIndex = idx % baseProducts.length
          const theme = BANNER_THEMES[originalIndex % BANNER_THEMES.length]
          const oldPrice = Number(product.price) * 1.18
          const avgRating = product.average_rating ?? 0
          const revCount = product.reviews_count ?? 0

          return (
            <div
              key={`${product.id}-clone-${idx}`}
              onClick={() => onSelectProduct(product)}
              className="group relative shrink-0 w-64 sm:w-72 h-96 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-indigo-400"
            >
              {/* Imagem de Fundo Vertical */}
              {product.image || product.image_url ? (
                <img
                  src={product.image || product.image_url}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition duration-500"
                />
              ) : (
                <div className="absolute inset-0 bg-slate-800" />
              )}

              {/* Overlay Gradiente Vertical */}
              <div
                className={`absolute inset-0 bg-gradient-to-t ${theme.accent}`}
              />

              {/* Topo do Banner Vertical: Tag de Oferta + Categoria */}
              <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide shadow-xs ${theme.pill}`}
                >
                  {theme.badge}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/50 text-white backdrop-blur-xs">
                  {product.category_name}
                </span>
              </div>

              {/* Base do Banner Vertical: Informações do Produto + CTA */}
              <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col justify-end text-white space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
                      Até 15% OFF • Envio Full
                    </span>
                    {revCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {avgRating.toFixed(1)} ({revCount})
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-extrabold leading-snug line-clamp-2 group-hover:text-amber-200 transition">
                    {product.name}
                  </h3>
                  <p className="text-xs text-slate-200/90 line-clamp-2">
                    {product.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/15 flex items-end justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-slate-300 line-through block">
                      {formatBRL(oldPrice)}
                    </span>
                    <span className="text-xl font-extrabold text-white tracking-tight">
                      {formatBRL(product.price)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (product.stock > 0) {
                          onAddToCart(product)
                        }
                      }}
                      disabled={product.stock <= 0}
                      title="Adicionar direto ao carrinho"
                      className="p-2.5 rounded-xl bg-white/15 hover:bg-white/30 text-white backdrop-blur-xs transition cursor-pointer disabled:opacity-40"
                    >
                      <ShoppingBag className="w-4 h-4" />
                    </button>
                    <span className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-extrabold group-hover:bg-amber-300 transition">
                      Ver Oferta
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
