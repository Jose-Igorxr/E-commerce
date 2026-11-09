import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  MapPin,
  Truck,
  CreditCard,
  QrCode,
  FileText,
  Wallet,
  ShieldCheck,
  Package,
  Search,
  CheckCircle2,
  Tag,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { checkoutServerCart, lookupCepAddress } from '../services/api'
import type {
  CartItem,
  OrderResponse,
  PaymentMethod,
  UserProfile,
} from '../types/store'

interface CheckoutViewProps {
  user: UserProfile
  cart: CartItem[]
  onBackToStore: () => void
  onOrderSuccess: (order: OrderResponse) => void
}

// Tabela de frete base por região/UF a partir do CEP
function calculateRegionalShipping(uf: string, subtotal: number) {
  const cleanUf = uf.toUpperCase()
  const southeastSouth = ['SP', 'RJ', 'MG', 'ES', 'PR', 'SC', 'RS']
  const midwestNortheast = [
    'DF',
    'GO',
    'MT',
    'MS',
    'BA',
    'PE',
    'CE',
    'RN',
    'PB',
    'AL',
    'SE',
    'MA',
    'PI',
  ]

  let basePac = 34.9
  let baseSedex = 59.9
  let pacDays = '5 a 8 dias úteis'
  let sedexDays = '2 a 3 dias úteis'

  if (southeastSouth.includes(cleanUf)) {
    basePac = 19.9
    baseSedex = 34.9
    pacDays = '3 a 5 dias úteis'
    sedexDays = '1 a 2 dias úteis'
  } else if (midwestNortheast.includes(cleanUf)) {
    basePac = 27.9
    baseSedex = 46.9
    pacDays = '4 a 7 dias úteis'
    sedexDays = '2 a 3 dias úteis'
  }

  // Compras acima de R$ 999 ganham Frete Padrão Grátis
  const isFreePac = subtotal >= 999

  return {
    pacCost: isFreePac ? 0 : basePac,
    pacDays,
    sedexCost: baseSedex,
    sedexDays,
  }
}

export default function CheckoutView({
  user,
  cart,
  onBackToStore,
  onOrderSuccess,
}: CheckoutViewProps) {
  // Endereço e CEP
  const [cep, setCep] = useState('')
  const [loadingCep, setLoadingCep] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [stateUf, setStateUf] = useState('')
  const [shippingOption, setShippingOption] = useState<'pac' | 'sedex'>('pac')

  // Pagamento
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [installments, setInstallments] = useState<number>(1)
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolder, setCardHolder] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')

  // Cupom
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<string>('')
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null)

  // Submissão
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (acc, item) => acc + Number(item.product.price) * item.quantity,
        0,
      ),
    [cart],
  )

  const shippingInfo = useMemo(() => {
    if (!stateUf) return null
    return calculateRegionalShipping(stateUf, subtotal)
  }, [stateUf, subtotal])

  const shippingCost = useMemo(() => {
    if (appliedCoupon === 'FRETEGRATIS') return 0
    if (!shippingInfo) return 0
    return shippingOption === 'pac'
      ? shippingInfo.pacCost
      : shippingInfo.sedexCost
  }, [shippingInfo, shippingOption, appliedCoupon])

  const pixDiscount = useMemo(
    () => (paymentMethod === 'pix' ? subtotal * 0.05 : 0),
    [paymentMethod, subtotal],
  )

  const couponDiscount = useMemo(
    () => (appliedCoupon === 'BEMVINDO10' ? subtotal * 0.1 : 0),
    [appliedCoupon, subtotal],
  )

  const totalDiscount = pixDiscount + couponDiscount
  const finalTotal = Math.max(0, subtotal - totalDiscount + shippingCost)

  const formatBRL = (value: number | string) =>
    Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

  const handleCepSearch = async (rawCepValue?: string) => {
    const targetCep = (rawCepValue ?? cep).replace(/\D/g, '')
    if (targetCep.length !== 8) {
      setCepError('Digite um CEP válido com 8 números.')
      return
    }

    setLoadingCep(true)
    setCepError(null)
    try {
      const addr = await lookupCepAddress(targetCep)
      setStreet(addr.street)
      setNeighborhood(addr.neighborhood)
      setCity(addr.city)
      setStateUf(addr.state)
    } catch {
      setCepError(
        'Não foi possível localizar o CEP automaticamente. Você pode preencher os campos manualmente abaixo.',
      )
    } finally {
      setLoadingCep(false)
    }
  }

  const handleCepChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    const formatted =
      digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    setCep(formatted)
    if (digits.length === 8) {
      handleCepSearch(digits)
    }
  }

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase()
    if (code === 'BEMVINDO10') {
      setAppliedCoupon('BEMVINDO10')
      setCouponFeedback('Cupom BEMVINDO10 aplicado: 10% de desconto adicional!')
    } else if (code === 'FRETEGRATIS') {
      setAppliedCoupon('FRETEGRATIS')
      setCouponFeedback('Cupom FRETEGRATIS aplicado: Frete gratuito garantido!')
    } else {
      setAppliedCoupon('')
      setCouponFeedback('Cupom inválido. Experimente BEMVINDO10 ou FRETEGRATIS.')
    }
  }

  const handleSubmitOrder = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    const cleanCep = cep.replace(/\D/g, '')
    if (cleanCep.length !== 8 || !street.trim() || !number.trim() || !city.trim() || !stateUf.trim()) {
      setSubmitError(
        'Por favor, preencha o CEP, rua, número, cidade e estado para entrega.',
      )
      return
    }

    if (
      (paymentMethod === 'credit_card' || paymentMethod === 'debit_card') &&
      (!cardNumber.trim() || !cardHolder.trim() || !cardExpiry.trim() || !cardCvv.trim())
    ) {
      setSubmitError('Por favor, preencha os dados do cartão para continuar.')
      return
    }

    const formattedAddress = [
      `${street.trim()}, nº ${number.trim()}`,
      complement.trim() ? `Compl: ${complement.trim()}` : '',
      neighborhood.trim() ? `Bairro: ${neighborhood.trim()}` : '',
      `${city.trim()} - ${stateUf.trim().toUpperCase()}`,
      `CEP: ${cep}`,
      `Envio: ${shippingOption === 'pac' ? 'Entrega Padrão (PAC)' : 'Entrega Expressa (SEDEX Full)'}`,
    ]
      .filter(Boolean)
      .join(' • ')

    setSubmitting(true)
    try {
      const createdOrder = await checkoutServerCart({
        payment_method: paymentMethod,
        installments: paymentMethod === 'credit_card' ? installments : 1,
        shipping_cep: cep,
        shipping_address: formattedAddress,
        shipping_cost: shippingCost.toFixed(2),
        coupon_code: appliedCoupon || undefined,
      })
      onOrderSuccess(createdOrder)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setSubmitError(
        axiosErr.response?.data?.detail ||
          'Não foi possível concluir o pedido. Verifique os dados e o estoque.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto w-full px-4 py-16 text-center space-y-4">
        <Package className="w-12 h-12 text-slate-400 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">
          Seu carrinho está vazio
        </h2>
        <p className="text-sm text-slate-500">
          Adicione produtos ao carrinho antes de prosseguir para o checkout.
        </p>
        <button
          onClick={onBackToStore}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para a vitrine
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-6">
      {/* Topo da Página de Checkout */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBackToStore}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Continuar comprando
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Finalização do Pedido (Checkout)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Confirme seu endereço de entrega por CEP e escolha a forma de pagamento
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Ambiente 100% Seguro • Comprando como {user.first_name || user.username}
        </div>
      </div>

      <form
        onSubmit={handleSubmitOrder}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Coluna Esquerda: Endereço/Frete + Pagamento */}
        <div className="lg:col-span-7 space-y-6">
          {/* Bloco 1: Endereço e Cálculo de Frete por CEP */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  1. Endereço de Entrega e Cálculo de Frete
                </h2>
                <p className="text-xs text-slate-500">
                  Digite seu CEP para buscar o endereço automaticamente via ViaCEP / BrasilAPI
                </p>
              </div>
            </div>

            {/* Busca por CEP */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-56">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CEP *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="01001-000"
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCepSearch()}
                disabled={loadingCep}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
              >
                {loadingCep ? 'Buscando CEP...' : 'Buscar Endereço'}
              </button>

              <button
                type="button"
                onClick={() => handleCepChange('01310100')}
                className="text-xs text-indigo-600 hover:underline font-medium cursor-pointer py-2"
              >
                Testar CEP Av. Paulista (01310-100)
              </button>
            </div>

            {cepError && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                {cepError}
              </p>
            )}

            {/* Campos do Endereço */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rua / Logradouro *
                </label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Rua, Avenida..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número *
                </label>
                <input
                  type="text"
                  required
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="Ex: 1000"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Complemento (opcional)
                </label>
                <input
                  type="text"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  placeholder="Apto, Bloco..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-7">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Bairro"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-9">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cidade *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Sua cidade"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  UF *
                </label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={stateUf}
                  onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                  placeholder="SP"
                  className="w-full px-3.5 py-2 text-sm uppercase rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Opções de Frete Calculadas */}
            {shippingInfo && (
              <div className="pt-2 space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-indigo-600" />
                  Modalidade de Frete para {city || stateUf} ({stateUf}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    onClick={() => setShippingOption('pac')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                      shippingOption === 'pac'
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Entrega Padrão (PAC)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Receba em {shippingInfo.pacDays}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-700">
                      {shippingInfo.pacCost === 0
                        ? 'Grátis'
                        : formatBRL(shippingInfo.pacCost)}
                    </span>
                  </label>

                  <label
                    onClick={() => setShippingOption('sedex')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                      shippingOption === 'sedex'
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Expresso Full (SEDEX)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Receba em {shippingInfo.sedexDays}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-slate-900">
                      {appliedCoupon === 'FRETEGRATIS'
                        ? 'Grátis'
                        : formatBRL(shippingInfo.sedexCost)}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </section>

          {/* Bloco 2: Forma de Pagamento */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  2. Forma de Pagamento
                </h2>
                <p className="text-xs text-slate-500">
                  Escolha entre PIX, Cartão de Crédito, Débito ou Boleto Bancário
                </p>
              </div>
            </div>

            {/* Abas de Seleção de Método */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                {
                  id: 'pix' as PaymentMethod,
                  label: 'PIX',
                  sub: '5% de desconto',
                  icon: QrCode,
                },
                {
                  id: 'credit_card' as PaymentMethod,
                  label: 'Crédito',
                  sub: 'Até 10x sem juros',
                  icon: CreditCard,
                },
                {
                  id: 'debit_card' as PaymentMethod,
                  label: 'Débito',
                  sub: 'À vista no cartão',
                  icon: Wallet,
                },
                {
                  id: 'boleto' as PaymentMethod,
                  label: 'Boleto',
                  sub: 'Vence em 3 dias',
                  icon: FileText,
                },
              ].map((method) => {
                const Icon = method.icon
                const active = paymentMethod === method.id
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                      active
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        active ? 'text-indigo-600' : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        {method.label}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {method.sub}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Detalhes Específicos da Forma de Pagamento Selecionada */}
            {paymentMethod === 'pix' && (
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Desconto imediato de 5% aplicado ({formatBRL(pixDiscount)} de economia!)
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Ao confirmar o pedido, o código PIX Copia e Cola e o QR Code são
                  processados com aprovação instantânea e liberação imediata para envio.
                </p>
              </div>
            )}

            {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Número do Cartão *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="0000 0000 0000 0000"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome Impresso no Cartão *
                    </label>
                    <input
                      type="text"
                      required
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                      placeholder="NOME COMO NO CARTÃO"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Validade (MM/AA) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="12/30"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      CVV *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="123"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {paymentMethod === 'credit_card' && (
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Parcelamento
                      </label>
                      <select
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <option key={n} value={n}>
                            {n}x de {formatBRL(finalTotal / n)} sem juros
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {paymentMethod === 'boleto' && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5 text-xs text-amber-900">
                <p className="font-bold">Boleto Bancário Registrado</p>
                <p className="text-amber-800">
                  O pedido será criado com status <strong>Pendente</strong> e o
                  estoque já ficará reservado para você. A confirmação ocorre em até
                  1 dia útil após o pagamento.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Coluna Direita: Resumo do Pedido + Miniaturas dos Produtos */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <section className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Resumo do Pedido ({cart.reduce((acc, i) => acc + i.quantity, 0)} itens)
            </h2>

            {/* Lista de Produtos com Miniatura */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1 divide-y divide-slate-100">
              {cart.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="pt-3 first:pt-0 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {product.image || product.image_url ? (
                        <img
                          src={product.image || product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {product.name}
                      </h4>
                      <span className="text-[11px] text-slate-500 block">
                        Qtd: {quantity} × {formatBRL(product.price)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900 shrink-0">
                    {formatBRL(Number(product.price) * quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Cupom de Desconto */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                Cupom Promocional (teste: <code className="text-indigo-600">BEMVINDO10</code>)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Digite seu cupom"
                  className="flex-1 px-3 py-2 text-xs uppercase rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                >
                  Aplicar
                </button>
              </div>
              {couponFeedback && (
                <p className="text-[11px] font-medium text-indigo-600">
                  {couponFeedback}
                </p>
              )}
            </div>

            {/* Detalhamento de Valores */}
            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal dos produtos</span>
                <span className="font-semibold text-slate-900">
                  {formatBRL(subtotal)}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Frete ({stateUf ? `${city} - ${stateUf}` : 'Informe o CEP'})</span>
                <span className="font-semibold text-slate-900">
                  {!stateUf
                    ? 'A calcular'
                    : shippingCost === 0
                      ? 'Grátis'
                      : formatBRL(shippingCost)}
                </span>
              </div>

              {pixDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-700 font-medium">
                  <span>Desconto PIX (5% OFF)</span>
                  <span>- {formatBRL(pixDiscount)}</span>
                </div>
              )}

              {couponDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-700 font-medium">
                  <span>Cupom ({appliedCoupon})</span>
                  <span>- {formatBRL(couponDiscount)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-900">
                  Total do Pedido
                </span>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-indigo-600 block">
                    {formatBRL(finalTotal)}
                  </span>
                  {paymentMethod === 'credit_card' && installments > 1 && (
                    <span className="text-[11px] text-slate-500">
                      em {installments}x de {formatBRL(finalTotal / installments)} sem juros
                    </span>
                  )}
                </div>
              </div>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 shadow-sm disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Processando seu pedido...' : 'Confirmar e Concluir Pedido'}
            </button>
          </section>
        </div>
      </form>
    </div>
  )
}
