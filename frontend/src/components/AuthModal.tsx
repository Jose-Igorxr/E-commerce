import { useState, type FormEvent } from 'react'
import { X, Lock, User, Mail, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react'
import { loginUser, registerUser } from '../services/api'
import type { UserProfile } from '../types/store'

interface AuthModalProps {
  isOpen: boolean
  checkoutRedirectMessage?: boolean
  onClose: () => void
  onSuccess: (user: UserProfile) => void
}

export default function AuthModal({
  isOpen,
  checkoutRedirectMessage = false,
  onClose,
  onSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const res = await loginUser({ username, password })
        onSuccess(res.user)
        onClose()
      } else {
        const res = await registerUser({
          username,
          email,
          first_name: firstName,
          password,
        })
        onSuccess(res.user)
        onClose()
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, unknown> } }
      const data = axiosErr.response?.data
      if (data) {
        const firstMsg = Object.values(data).flat()[0]
        setError(
          typeof firstMsg === 'string'
            ? firstMsg
            : 'Credenciais inválidas ou dados incorretos.',
        )
      } else {
        setError('Não foi possível autenticar. Verifique sua conexão.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fillDemoCredentials = (demoUser: string, demoPass: string) => {
    setMode('login')
    setError(null)
    setUsername(demoUser)
    setPassword(demoPass)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {mode === 'login' ? 'Entrar na sua conta' : 'Criar conta de Cliente'}
            </h2>
            <p className="text-xs text-slate-300">
              Autenticação segura via JWT + Grupos do Django
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        {checkoutRedirectMessage && (
          <div className="px-6 py-2.5 bg-indigo-50 border-b border-indigo-100 text-indigo-800 text-xs font-medium">
            Para finalizar sua compra, entre na sua conta ou cadastre-se gratuitamente. Seus itens do carrinho serão mantidos!
          </div>
        )}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError(null)
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Já tenho conta (Login)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register')
              setError(null)
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Criar conta (Cliente)
          </button>
        </div>

        {/* Demo Quick Fill */}
        {mode === 'login' && (
          <div className="px-6 pt-4">
            <p className="text-xs font-medium text-slate-500 mb-2">
              Acesso rápido para teste de perfis (Grupos do Django):
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemoCredentials('vendedor', 'vendedor123')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                Vendedor / Admin
              </button>
              <button
                type="button"
                onClick={() => fillDemoCredentials('cliente', 'cliente123')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Cliente Padrão
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Usuário
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: cliente ou vendedor"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer"
          >
            {submitting
              ? 'Processando...'
              : mode === 'login'
                ? 'Entrar'
                : 'Cadastrar como Cliente'}
          </button>
        </form>
      </div>
    </div>
  )
}
