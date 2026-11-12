export interface Category {
  id: number
  name: string
  slug: string
  description: string
  products_count: number
  created_at: string
}

export interface Product {
  id: number
  category: number
  category_name: string
  name: string
  slug: string
  description: string
  price: string
  stock: number
  image_url: string
  image: string | null
  is_active: boolean
  featured: boolean
  average_rating?: number
  reviews_count?: number
  user_can_review?: boolean
  created_at: string
  updated_at: string
}

export interface ReviewItem {
  id: number
  product: number
  user: number
  username: string
  user_name: string
  is_seller: boolean
  rating: number
  comment: string
  created_at: string
}

export interface ProductPayload {
  category: number
  name: string
  description: string
  price: string
  stock: number
  image_url: string
  is_active: boolean
  featured: boolean
}

export interface PaginatedResponse<T> {
  count: number
  total_pages?: number
  current_page?: number
  page_size?: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface CartItem {
  id?: number
  product: Product
  quantity: number
}

export interface ServerCart {
  id: number
  user: number
  items: CartItem[]
  updated_at: string
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'canceled'

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'boleto'

export interface CheckoutPayload {
  customer_name?: string
  customer_email?: string
  payment_method: PaymentMethod
  installments: number
  shipping_cep: string
  shipping_address: string
  shipping_cost: string
  coupon_code?: string
}

export interface OrderItemResponse {
  id: number
  product: number
  product_name: string
  product_image?: string
  quantity: number
  unit_price: string
}

export interface OrderResponse {
  id: number
  user: number | null
  customer_name: string
  customer_email: string
  status: OrderStatus
  status_display?: string
  payment_method?: PaymentMethod
  payment_method_display?: string
  installments?: number
  subtotal_amount?: string
  shipping_cost?: string
  discount_amount?: string
  total_amount: string
  shipping_cep?: string
  shipping_address?: string
  items: OrderItemResponse[]
  created_at: string
  updated_at?: string
}

export interface UserProfile {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  is_superuser: boolean
  groups: string[]
  is_seller: boolean
  role: 'seller' | 'customer'
}

export interface AuthResponse {
  access: string
  refresh: string
  user: UserProfile
}
