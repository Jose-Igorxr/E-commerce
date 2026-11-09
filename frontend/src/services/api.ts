import axios from 'axios'
import type {
  AuthResponse,
  CartItem,
  Category,
  CheckoutPayload,
  OrderResponse,
  OrderStatus,
  PaginatedResponse,
  Product,
  ProductPayload,
  ReviewItem,
  ServerCart,
  UserProfile,
} from '../types/store'

export const ACCESS_TOKEN_KEY = 'novastore:access_token'
export const REFRESH_TOKEN_KEY = 'novastore:refresh_token'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor para renovar automaticamente o access_token via refresh_token se expirar (401)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/token/')
    ) {
      originalRequest._retry = true
      const refresh = localStorage.getItem(REFRESH_TOKEN_KEY)
      if (refresh) {
        try {
          const { data } = await axios.post<{ access: string; refresh?: string }>(
            '/api/auth/token/refresh/',
            { refresh },
          )
          localStorage.setItem(ACCESS_TOKEN_KEY, data.access)
          if (data.refresh) {
            localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh)
          }
          originalRequest.headers.Authorization = `Bearer ${data.access}`
          return api(originalRequest)
        } catch {
          clearAuthTokens()
        }
      }
    }
    return Promise.reject(error)
  },
)

export function saveAuthTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access)
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export async function loginUser(credentials: {
  username: string
  password: string
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/token/', credentials)
  saveAuthTokens(data.access, data.refresh)
  return data
}

export async function registerUser(payload: {
  username: string
  email: string
  first_name?: string
  last_name?: string
  password: string
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register/', payload)
  saveAuthTokens(data.access, data.refresh)
  return data
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>('/auth/me/')
  return data
}

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await api.get<PaginatedResponse<Category> | Category[]>(
    '/store/categories/',
  )
  return Array.isArray(data) ? data : data.results
}

export async function fetchProducts(params?: {
  category__slug?: string
  search?: string
  featured?: boolean
  ordering?: string
}): Promise<Product[]> {
  const { data } = await api.get<PaginatedResponse<Product> | Product[]>(
    '/store/products/',
    { params },
  )
  return Array.isArray(data) ? data : data.results
}

export async function fetchProductById(id: number): Promise<Product> {
  const { data } = await api.get<Product>(`/store/products/${id}/`)
  return data
}

export async function createProduct(payload: ProductPayload): Promise<Product> {
  const { data } = await api.post<Product>('/store/products/', payload)
  return data
}

export async function updateProduct(
  id: number,
  payload: Partial<ProductPayload>,
): Promise<Product> {
  const { data } = await api.patch<Product>(`/store/products/${id}/`, payload)
  return data
}

export async function deleteProduct(id: number): Promise<void> {
  await api.delete(`/store/products/${id}/`)
}

// --- Carrinho Híbrido (Sincronização com Banco de Dados) ---

export async function fetchServerCart(): Promise<CartItem[]> {
  const { data } = await api.get<ServerCart>('/store/cart/')
  return data.items
}

export async function mergeCartWithServer(
  localItems: { product_id: number; quantity: number }[],
): Promise<CartItem[]> {
  const { data } = await api.post<ServerCart>('/store/cart/merge/', {
    items: localItems,
  })
  return data.items
}

export async function setServerCartItemQuantity(
  productId: number,
  quantity: number,
): Promise<CartItem[]> {
  const { data } = await api.post<ServerCart>('/store/cart/item/', {
    product_id: productId,
    quantity,
  })
  return data.items
}

export async function clearServerCart(): Promise<CartItem[]> {
  const { data } = await api.delete<ServerCart>('/store/cart/clear/')
  return data.items
}

export async function checkoutServerCart(
  payload: CheckoutPayload,
): Promise<OrderResponse> {
  const { data } = await api.post<OrderResponse>('/store/cart/checkout/', payload)
  return data
}

export interface CepAddressResult {
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
}

/**
 * Consulta o endereço pelo CEP usando a API pública ViaCEP
 * com fallback automático para a BrasilAPI.
 */
export async function lookupCepAddress(rawCep: string): Promise<CepAddressResult> {
  const cleanCep = rawCep.replace(/\D/g, '')
  if (cleanCep.length !== 8) {
    throw new Error('O CEP deve conter 8 dígitos.')
  }

  try {
    const { data } = await axios.get<{
      cep?: string
      logradouro?: string
      bairro?: string
      localidade?: string
      uf?: string
      erro?: boolean
    }>(`https://viacep.com.br/ws/${cleanCep}/json/`, { timeout: 5000 })

    if (data && !data.erro && data.localidade && data.uf) {
      return {
        cep: data.cep || cleanCep,
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade,
        state: data.uf,
      }
    }
  } catch {
    // Continua para o fallback BrasilAPI
  }

  const { data: brData } = await axios.get<{
    cep: string
    street?: string
    neighborhood?: string
    city: string
    state: string
  }>(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`, { timeout: 5000 })

  return {
    cep: brData.cep || cleanCep,
    street: brData.street || '',
    neighborhood: brData.neighborhood || '',
    city: brData.city,
    state: brData.state,
  }
}

export async function fetchMyOrders(): Promise<OrderResponse[]> {
  const { data } = await api.get<PaginatedResponse<OrderResponse> | OrderResponse[]>(
    '/store/orders/',
  )
  return Array.isArray(data) ? data : data.results
}

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
): Promise<OrderResponse> {
  const { data } = await api.patch<OrderResponse>(
    `/store/orders/${orderId}/status/`,
    { status },
  )
  return data
}

// --- Avaliações e Comentários de Produtos ---

export async function fetchProductReviews(productId: number): Promise<ReviewItem[]> {
  const { data } = await api.get<ReviewItem[]>(`/store/products/${productId}/reviews/`)
  return data
}

export async function createProductReview(
  productId: number,
  payload: { rating: number; comment: string },
): Promise<ReviewItem> {
  const { data } = await api.post<ReviewItem>(
    `/store/products/${productId}/reviews/`,
    payload,
  )
  return data
}

export async function deleteProductReview(
  productId: number,
  reviewId: number,
): Promise<void> {
  await api.delete(`/store/products/${productId}/reviews/${reviewId}/`)
}
