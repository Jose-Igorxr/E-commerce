import { useEffect, useState, type FormEvent } from 'react'
import { X, AlertCircle, Plus, Check, FolderPlus } from 'lucide-react'
import { createCategory, createProduct, updateProduct } from '../services/api'
import type { Category, Product, ProductPayload } from '../types/store'

interface ProductFormModalProps {
  isOpen: boolean
  categories: Category[]
  editingProduct: Product | null
  onClose: () => void
  onSaved: () => void
  onCategoryCreated?: (newCategory: Category) => void
}

export default function ProductFormModal({
  isOpen,
  categories,
  editingProduct,
  onClose,
  onSaved,
  onCategoryCreated,
}: ProductFormModalProps) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number>(0)
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('10')
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState('')
  const [featured, setFeatured] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Criação rápida de categoria embutida no cadastro de produto
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryDesc, setNewCategoryDesc] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  const [categorySuccessMsg, setCategorySuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name)
      setCategoryId(editingProduct.category)
      setPrice(editingProduct.price)
      setStock(String(editingProduct.stock))
      setImageUrl(editingProduct.image_url || '')
      setDescription(editingProduct.description || '')
      setFeatured(editingProduct.featured)
      setIsActive(editingProduct.is_active)
    } else {
      setName('')
      setCategoryId(categories[0]?.id ?? 0)
      setPrice('')
      setStock('10')
      setImageUrl('')
      setDescription('')
      setFeatured(false)
      setIsActive(true)
    }
    setCreatingCategory(false)
    setNewCategoryName('')
    setNewCategoryDesc('')
    setCategorySuccessMsg(null)
    setError(null)
  }, [editingProduct, isOpen])

  // Garante que categoryId tenha um valor válido quando as categorias carregam
  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(editingProduct ? editingProduct.category : categories[0].id)
    }
  }, [categories, categoryId, editingProduct])

  if (!isOpen) return null

  const handleQuickCreateCategory = async () => {
    const trimmed = newCategoryName.trim()
    if (!trimmed) {
      setError('Informe o nome da nova categoria.')
      return
    }
    setError(null)
    setSavingCategory(true)
    try {
      const created = await createCategory({
        name: trimmed,
        description: newCategoryDesc.trim(),
      })
      onCategoryCreated?.(created)
      setCategoryId(created.id)
      setNewCategoryName('')
      setNewCategoryDesc('')
      setCreatingCategory(false)
      setCategorySuccessMsg(`Categoria "${created.name}" criada e selecionada!`)
      setTimeout(() => setCategorySuccessMsg(null), 3500)
    } catch {
      setError('Não foi possível criar a categoria. Verifique se o nome já existe.')
    } finally {
      setSavingCategory(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const payload: ProductPayload = {
      name,
      category: categoryId || (categories[0]?.id ?? 1),
      price,
      stock: Number(stock) || 0,
      image_url: imageUrl,
      description,
      featured,
      is_active: isActive,
    }

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload)
      } else {
        await createProduct(payload)
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, unknown> } }
      const data = axiosErr.response?.data
      if (data) {
        const firstMsg = Object.values(data).flat()[0]
        setError(
          typeof firstMsg === 'string'
            ? firstMsg
            : 'Erro ao salvar produto. Verifique as permissões e campos.',
        )
      } else {
        setError('Falha ao salvar o produto.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </h2>
            <p className="text-xs text-slate-300">
              Área exclusiva do grupo Vendedor / Administrador
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Produto
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Monitor Gamer 27'' QHD"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Categoria
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingCategory((prev) => !prev)
                    setError(null)
                  }}
                  className="inline-flex items-center gap-0.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  {creatingCategory ? 'Fechar' : 'Nova'}
                </button>
              </div>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Preço (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="999.90"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estoque
              </label>
              <input
                type="number"
                min="0"
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Sub-painel Inline para Criar Nova Categoria sem sair do cadastro do produto */}
          {creatingCategory && (
            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                  <FolderPlus className="w-4 h-4 text-indigo-600" />
                  Criar Nova Categoria de Produto
                </span>
                <button
                  type="button"
                  onClick={() => setCreatingCategory(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria (ex: Monitores)"
                  className="px-3 py-1.5 text-xs rounded-lg border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  placeholder="Descrição curta (opcional)"
                  className="px-3 py-1.5 text-xs rounded-lg border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={savingCategory || !newCategoryName.trim()}
                  onClick={handleQuickCreateCategory}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  {savingCategory ? 'Criando...' : 'Salvar e Selecionar Categoria'}
                </button>
              </div>
            </div>
          )}

          {categorySuccessMsg && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{categorySuccessMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              URL da Imagem
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes técnicos e diferenciais do produto..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Produto em Destaque
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Visível na Loja (Ativo)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
            >
              {submitting
                ? 'Salvando...'
                : editingProduct
                  ? 'Salvar Alterações'
                  : 'Cadastrar Produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
