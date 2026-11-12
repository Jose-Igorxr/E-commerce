import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Package,
  Search,
  Star,
  FolderPlus,
  Check,
  Tag,
  Eye,
  EyeOff,
  RotateCcw,
  AlertTriangle,
  X,
} from 'lucide-react'
import {
  createCategory,
  deleteCategory,
  deleteProduct,
  fetchProducts,
  toggleProductSoftDelete,
} from '../services/api'
import type { Category, Product } from '../types/store'

interface ProductsManagementViewProps {
  categories: Category[]
  onBack: () => void
  onOpenNewProduct: () => void
  onEditProduct: (product: Product) => void
  onViewProduct: (product: Product) => void
  onCategoriesRefresh: () => void
  onProductRemovedFromStore?: (productId: number) => void
}

export default function ProductsManagementView({
  categories,
  onBack,
  onOpenNewProduct,
  onEditProduct,
  onViewProduct,
  onCategoriesRefresh,
  onProductRemovedFromStore,
}: ProductsManagementViewProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filterCategorySlug, setFilterCategorySlug] = useState<string>('')

  // Criação rápida de categoria também disponível no painel
  const [showNewCatForm, setShowNewCatForm] = useState<boolean>(false)
  const [newCatName, setNewCatName] = useState<string>('')
  const [newCatDesc, setNewCatDesc] = useState<string>('')
  const [savingCat, setSavingCat] = useState<boolean>(false)
  const [catFeedback, setCatFeedback] = useState<string | null>(null)

  // Estados para Soft Delete e Modal de Confirmação Exigente de Hard Delete
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Product | null>(null)
  const [hardDeleteConfirmInput, setHardDeleteConfirmInput] = useState<string>('')
  const [hardDeleting, setHardDeleting] = useState<boolean>(false)

  const loadAllProducts = useCallback(() => {
    setLoading(true)
    fetchProducts({ page_size: 48 })
      .then((prods) => setAllProducts(prods))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadAllProducts()
  }, [loadAllProducts])

  const handleSoftDeleteToggle = async (product: Product) => {
    setTogglingId(product.id)
    try {
      const updated = await toggleProductSoftDelete(product.id, !product.is_active)
      setAllProducts((prev) =>
        prev.map((p) => (p.id === product.id ? updated : p)),
      )
      if (!updated.is_active) {
        onProductRemovedFromStore?.(product.id)
      }
      onCategoriesRefresh()
    } catch {
      alert('Não foi possível alterar o status de ativação do produto.')
    } finally {
      setTogglingId(null)
    }
  }

  const handleConfirmHardDelete = async () => {
    if (!hardDeleteTarget) return
    if (hardDeleteConfirmInput.trim() !== hardDeleteTarget.name.trim()) return

    setHardDeleting(true)
    try {
      await deleteProduct(hardDeleteTarget.id)
      setAllProducts((prev) => prev.filter((p) => p.id !== hardDeleteTarget.id))
      onProductRemovedFromStore?.(hardDeleteTarget.id)
      onCategoriesRefresh()
      setHardDeleteTarget(null)
      setHardDeleteConfirmInput('')
    } catch {
      alert('Não foi possível realizar a exclusão permanente do produto.')
    } finally {
      setHardDeleting(false)
    }
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    setSavingCat(true)
    try {
      const created = await createCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim(),
      })
      onCategoriesRefresh()
      setNewCatName('')
      setNewCatDesc('')
      setShowNewCatForm(false)
      setCatFeedback(`Categoria "${created.name}" adicionada com sucesso!`)
      setTimeout(() => setCatFeedback(null), 3500)
    } catch {
      alert('Não foi possível criar a categoria. Verifique se o nome já existe.')
    } finally {
      setSavingCat(false)
    }
  }

  const handleDeleteCategory = async (cat: Category) => {
    if (
      !window.confirm(
        `Deseja excluir a categoria "${cat.name}"? (Apenas categorias sem produtos vinculados ou que possam ser removidas serão excluídas)`,
      )
    ) {
      return
    }
    try {
      await deleteCategory(cat.slug)
      if (filterCategorySlug === cat.slug) setFilterCategorySlug('')
      onCategoriesRefresh()
    } catch {
      alert(
        'Não foi possível excluir esta categoria. Verifique se existem produtos vinculados a ela.',
      )
    }
  }

  const filteredProducts = allProducts.filter((prod) => {
    const matchesSearch =
      !searchTerm.trim() ||
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.category_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory =
      !filterCategorySlug ||
      categories.find((c) => c.slug === filterCategorySlug)?.id === prod.category
    return matchesSearch && matchesCategory
  })

  const formatBRL = (value: number | string) =>
    Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

  return (
    <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-6">
      {/* Cabeçalho da Aba de Gestão de Produtos */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a Vitrine
          </button>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Gestão de Produtos & Categorias
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Cadastre, edite estoques, destaque produtos e organize as categorias da loja.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowNewCatForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-indigo-600" />
            Nova Categoria
          </button>
          <button
            type="button"
            onClick={onOpenNewProduct}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-semibold hover:bg-indigo-500 shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Produto
          </button>
        </div>
      </div>

      {/* Cards de Resumo do Catálogo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500">Total de Produtos</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {allProducts.length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500">Produtos Visíveis</span>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">
            {allProducts.filter((p) => p.is_active).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500">Em Destaque</span>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">
            {allProducts.filter((p) => p.featured).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500">Categorias</span>
          <p className="text-2xl font-extrabold text-indigo-600 mt-1">
            {categories.length}
          </p>
        </div>
      </div>

      {/* Formulário Expansível de Nova Categoria */}
      {showNewCatForm && (
        <form
          onSubmit={handleCreateCategory}
          className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-indigo-950">
              <FolderPlus className="w-4 h-4 text-indigo-600" />
              Adicionar Nova Categoria
            </span>
            <span className="text-[11px] text-indigo-700">
              Dica: você também pode criar categorias direto na janela de Novo Produto!
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nome da categoria (ex: Periféricos)"
              className="px-3.5 py-2 text-sm rounded-xl border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              placeholder="Descrição (opcional)"
              className="px-3.5 py-2 text-sm rounded-xl border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingCat || !newCatName.trim()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {savingCat ? 'Salvando...' : 'Salvar Categoria'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewCatForm(false)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {catFeedback && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{catFeedback}</span>
        </div>
      )}

      {/* Faixa de Categorias e Filtro Rápido */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Tag className="w-4 h-4 text-indigo-600" />
            <span>Filtrar por Categoria:</span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar produto na gestão..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFilterCategorySlug('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              filterCategorySlug === ''
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todas ({allProducts.length})
          </button>
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                filterCategorySlug === cat.slug
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setFilterCategorySlug(cat.slug)}
                className="cursor-pointer"
              >
                {cat.name}
              </button>
              <button
                type="button"
                title={`Excluir categoria ${cat.name}`}
                onClick={() => handleDeleteCategory(cat)}
                className={`p-0.5 rounded hover:text-rose-500 cursor-pointer ${
                  filterCategorySlug === cat.slug ? 'text-indigo-200' : 'text-slate-400'
                }`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Carregando produtos da loja...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              Nenhum produto encontrado para este filtro.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Produto</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4">Preço</th>
                  <th className="py-3.5 px-4">Estoque</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-slate-50/80 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                          {product.image || product.image_url ? (
                            <img
                              src={product.image || product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 truncate">
                              {product.name}
                            </span>
                            {product.featured && (
                              <span
                                title="Produto em Destaque no Carrossel"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800"
                              >
                                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                Destaque
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1 max-w-md">
                            {product.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {product.category_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {formatBRL(product.price)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          product.stock > 5
                            ? 'bg-emerald-50 text-emerald-700'
                            : product.stock > 0
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {product.stock} un.
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {product.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Ativo na Vitrine
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          Desativado (Soft Delete)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewProduct(product)}
                          title="Ver página do produto"
                          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditProduct(product)}
                          title="Editar produto"
                          className="p-2 rounded-xl border border-slate-200 text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Opção 1: Soft Delete (Desativar / Reativar mantendo no banco) */}
                        <button
                          type="button"
                          disabled={togglingId === product.id}
                          onClick={() => handleSoftDeleteToggle(product)}
                          title={
                            product.is_active
                              ? 'Soft Delete: Desativar produto na vitrine (mantém no banco e pedidos)'
                              : 'Reativar produto na vitrine'
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                            product.is_active
                              ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          {product.is_active ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Desativar</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reativar</span>
                            </>
                          )}
                        </button>

                        {/* Opção 2: Hard Delete (Exclusão Definitiva com Confirmação Rigorosa) */}
                        <button
                          type="button"
                          onClick={() => {
                            setHardDeleteTarget(product)
                            setHardDeleteConfirmInput('')
                          }}
                          title="Hard Delete: Excluir permanentemente do banco de dados"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmação Rigorosa para Hard Delete */}
      {hardDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-200 overflow-hidden catalog-card-enter">
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <h2 className="text-base font-extrabold">
                    Exclusão Permanente (Hard Delete)
                  </h2>
                  <p className="text-[11px] text-rose-100">
                    Ação irreversível no banco de dados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHardDeleteTarget(null)}
                className="p-1 rounded-lg text-rose-100 hover:text-white hover:bg-rose-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                <p className="font-bold">
                  Prefere apenas ocultar este produto sem apagá-lo do banco?
                </p>
                <p className="text-amber-800">
                  O <strong>Soft Delete (Desativar)</strong> retira o produto da vitrine imediatamente, mas preserva seu cadastro e estoque para futura reativação.
                </p>
                {hardDeleteTarget.is_active && (
                  <button
                    type="button"
                    onClick={async () => {
                      const target = hardDeleteTarget
                      setHardDeleteTarget(null)
                      await handleSoftDeleteToggle(target)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 transition cursor-pointer"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    Aplicar Soft Delete (Apenas Desativar)
                  </button>
                )}
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <p>
                  Caso realmente deseje executar o <strong>Hard Delete</strong>, o registro do produto será removido definitivamente da tabela de produtos (os itens de pedidos já realizados manterão um <em>snapshot</em> de segurança).
                </p>
                <p className="text-slate-800 font-semibold">
                  Para confirmar que não é um clique acidental, digite exatamente o nome do produto abaixo:
                </p>
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 font-mono text-xs font-bold text-slate-900 select-all">
                  {hardDeleteTarget.name}
                </div>
                <input
                  type="text"
                  value={hardDeleteConfirmInput}
                  onChange={(e) => setHardDeleteConfirmInput(e.target.value)}
                  placeholder="Digite o nome exato do produto aqui..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setHardDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    hardDeleting ||
                    hardDeleteConfirmInput.trim() !== hardDeleteTarget.name.trim()
                  }
                  onClick={handleConfirmHardDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {hardDeleting ? 'Excluindo...' : 'Confirmar Hard Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
