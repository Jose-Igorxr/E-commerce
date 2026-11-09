import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ClipboardList,
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  Package,
  RefreshCw,
  User,
  Mail,
  ShieldCheck,
  MapPin,
  CreditCard,
} from 'lucide-react'
import { fetchMyOrders, updateOrderStatus } from '../services/api'
import type { OrderResponse, OrderStatus, UserProfile } from '../types/store'

interface OrdersViewProps {
  user: UserProfile
  onBack: () => void
  onCatalogRefresh: () => void
}

const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string
    badgeClass: string
    icon: typeof Clock
  }
> = {
  pending: {
    label: 'Pendente',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: Clock,
  },
  paid: {
    label: 'Pago',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: CheckCircle2,
  },
  shipped: {
    label: 'Enviado',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    icon: Truck,
  },
  delivered: {
    label: 'Entregue',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    icon: PackageCheck,
  },
  canceled: {
    label: 'Cancelado',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    icon: XCircle,
  },
}

export default function OrdersView({
  user,
  onBack,
  onCatalogRefresh,
}: OrdersViewProps) {
  const [orders, setOrders] = useState<OrderResponse[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null)

  const loadOrders = useCallback(() => {
    setLoading(true)
    fetchMyOrders()
      .then((data) => setOrders(data))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders
    return orders.filter((o) => o.status === statusFilter)
  }, [orders, statusFilter])

  const stats = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== 'canceled')
    const revenue = validOrders.reduce((acc, o) => acc + Number(o.total_amount), 0)
    const activeCount = orders.filter(
      (o) => o.status === 'paid' || o.status === 'pending' || o.status === 'shipped',
    ).length
    const deliveredCount = orders.filter((o) => o.status === 'delivered').length
    return {
      totalCount: orders.length,
      revenue,
      activeCount,
      deliveredCount,
    }
  }, [orders])

  const handleStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId)
    try {
      const updated = await updateOrderStatus(orderId, newStatus)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)))
      // Atualiza também o catálogo caso o pedido tenha sido cancelado/reativado (estorno de estoque)
      onCatalogRefresh()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      alert(
        axiosErr.response?.data?.detail ||
          'Não foi possível atualizar o status do pedido.',
      )
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const formatBRL = (value: number | string) =>
    Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-6">
      {/* Cabeçalho e Botão Voltar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a vitrine
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {user.is_seller ? 'Gestão Geral de Pedidos' : 'Meus Pedidos'}
            </h1>
            {user.is_seller && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                Visão Vendedor / Admin (Todos os Clientes)
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            {user.is_seller
              ? 'Acompanhe todas as vendas da loja e atualize o status de envio. Cancelar um pedido devolve automaticamente os itens ao estoque.'
              : `Exibindo exclusivamente os pedidos vinculados à sua conta (${user.username} — ID #${user.id}).`}
          </p>
        </div>

        <button
          onClick={loadOrders}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Lista
        </button>
      </div>

      {/* Cards de Resumo (KPIs) */}
      <div
        className={`grid grid-cols-1 gap-4 ${
          user.is_seller ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'
        }`}
      >
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block">
            {user.is_seller ? 'Total de Pedidos na Loja' : 'Total de Pedidos Realizados'}
          </span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
            {stats.totalCount}
          </span>
        </div>

        {user.is_seller && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block">
              Faturamento Confirmado
            </span>
            <span className="text-2xl font-extrabold text-indigo-600 mt-1 block">
              {formatBRL(stats.revenue)}
            </span>
          </div>
        )}

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block">
            Em Andamento (Pago / Enviado)
          </span>
          <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">
            {stats.activeCount}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block">
            Pedidos Entregues
          </span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
            {stats.deliveredCount}
          </span>
        </div>
      </div>

      {/* Filtros por Status */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'Todos' },
          { key: 'paid', label: 'Pagos' },
          { key: 'pending', label: 'Pendentes' },
          { key: 'shipped', label: 'Enviados' },
          { key: 'delivered', label: 'Entregues' },
          { key: 'canceled', label: 'Cancelados' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              statusFilter === tab.key
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista de Pedidos */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="bg-white rounded-2xl border border-slate-200 p-6 h-44 animate-pulse"
            />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <ClipboardList className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-800">
            Nenhum pedido encontrado
          </h3>
          <p className="text-sm text-slate-500">
            {statusFilter === 'all'
              ? 'Ainda não há pedidos registrados para esta visualização.'
              : 'Nenhum pedido corresponde ao filtro de status selecionado.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
            const StatusIcon = st.icon

            return (
              <article
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
              >
                {/* Cabeçalho do Pedido */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <span className="text-xs text-slate-400 block">Pedido</span>
                      <span className="text-sm font-extrabold text-slate-900">
                        #{order.id}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-slate-400 block">Data</span>
                      <span className="text-xs font-medium text-slate-700">
                        {formatDate(order.created_at)}
                      </span>
                    </div>

                    {order.payment_method_display && (
                      <div className="pl-2 border-l border-slate-200">
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <CreditCard className="w-3 h-3" /> Pagamento
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          {order.payment_method_display}
                          {order.payment_method === 'credit_card' &&
                          (order.installments ?? 1) > 1
                            ? ` (${order.installments}x)`
                            : ''}
                        </span>
                      </div>
                    )}

                    {user.is_seller && (
                      <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                        <div className="text-xs">
                          <span className="text-slate-400 flex items-center gap-1">
                            <User className="w-3 h-3" /> Cliente (ID #{order.user ?? 'Visitante'})
                          </span>
                          <span className="font-semibold text-slate-800">
                            {order.customer_name}
                          </span>
                        </div>
                        <div className="text-xs hidden sm:block">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> E-mail
                          </span>
                          <span className="text-slate-600">{order.customer_email}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Badge de Status + Seletor de Status para Vendedor */}
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${st.badgeClass}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {order.status_display || st.label}
                    </span>

                    {user.is_seller && (
                      <select
                        disabled={updatingOrderId === order.id}
                        value={order.status}
                        onChange={(e) =>
                          handleStatusChange(order.id, e.target.value as OrderStatus)
                        }
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                      >
                        <option value="pending">Mudar para: Pendente</option>
                        <option value="paid">Mudar para: Pago</option>
                        <option value="shipped">Mudar para: Enviado</option>
                        <option value="delivered">Mudar para: Entregue</option>
                        <option value="canceled">Mudar para: Cancelado (Estornar)</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Lista de Itens do Pedido */}
                <div className="p-6 divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200">
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 truncate">
                            {item.product_name}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {item.quantity} un. × {formatBRL(item.unit_price)} (preço congelado no pedido)
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-slate-900">
                          {formatBRL(Number(item.unit_price) * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rodapé com Endereço de Entrega + Detalhamento Financeiro */}
                <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 text-xs text-slate-500">
                    {order.shipping_address ? (
                      <p className="flex items-start gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                        <span>{order.shipping_address}</span>
                      </p>
                    ) : (
                      <span>
                        {order.items.reduce((acc, i) => acc + i.quantity, 0)} item(ns) no pedido
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-baseline gap-4 shrink-0">
                    {Number(order.shipping_cost ?? 0) > 0 && (
                      <span className="text-xs text-slate-500">
                        Frete: <strong>{formatBRL(order.shipping_cost!)}</strong>
                      </span>
                    )}
                    {Number(order.discount_amount ?? 0) > 0 && (
                      <span className="text-xs text-emerald-700 font-medium">
                        Desconto: <strong>- {formatBRL(order.discount_amount!)}</strong>
                      </span>
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-slate-500">
                        Total do Pedido:
                      </span>
                      <span className="text-lg font-extrabold text-slate-900">
                        {formatBRL(order.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
