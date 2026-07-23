export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  subCategory1?: string;
  subCategory2?: string;
  categories?: string[];
  brand?: string;
  featured?: boolean;
  sku?: string;
  stock?: number;
  expirationDate?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  isBrand?: boolean;
}

export interface Banner {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  cta: string;
  active: boolean;
  device?: "all" | "desktop" | "tablet" | "mobile";
  opacity?: number;
  overlayOpacity?: number;
}

export interface FooterConfig {
  storeName: string;
  description: string;
  email: string;
  whatsappDisplay: string;
  copyright: string;
  address?: string;
  mapEmbedUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
}

export interface StoreConfig {
  logoUrl: string;
  storeName: string;
  whatsappNumber: string;
  promoMessage?: string;
  banners: Banner[];
  categories: Category[];
  products: Product[];
  footer: FooterConfig;
}
