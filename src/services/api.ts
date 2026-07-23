import { Product, Category, Banner } from "@/types/store";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {};
  if (options?.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let errorMessage = `Erro na API (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.error) {
        errorMessage = parsed.error;
      } else if (parsed && parsed.message) {
        errorMessage = parsed.message;
      }
    } catch (e) {
      if (text && text.length < 150) {
        errorMessage = text;
      }
    }
    throw new Error(errorMessage);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : ([] as unknown as T);
}

// ── API Client ──
export const api = {
  products: {
    getAll: () => request<Product[]>("/products"),
    create: (p: Omit<Product, "id">) =>
      request<Product[]>("/products", { method: "POST", body: JSON.stringify(p) }),
    update: (id: string, p: Partial<Product>) =>
      request<Product[]>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(p) }),
    delete: (id: string) =>
      request<void>(`/products/${id}`, { method: "DELETE" }),
  },

  categories: {
    getAll: () => request<Category[]>("/categories"),
    create: (c: Omit<Category, "id">) =>
      request<Category[]>("/categories", { method: "POST", body: JSON.stringify(c) }),
    update: (id: string, c: Partial<Category>) =>
      request<Category[]>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(c) }),
    delete: (id: string) =>
      request<void>(`/categories/${id}`, { method: "DELETE" }),
  },

  banners: {
    getAll: () => request<Banner[]>("/banners"),
    create: (b: Omit<Banner, "id">) =>
      request<Banner[]>("/banners", { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Banner>) =>
      request<Banner[]>(`/banners/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
    delete: (id: string) =>
      request<void>(`/banners/${id}`, { method: "DELETE" }),
  },

  settings: {
    get: () => request<Array<{ key: string; value: string }>>("/settings"),
    upsert: (key: string, value: string) =>
      request<Array<{ key: string; value: string }>>("/settings", {
        method: "POST",
        body: JSON.stringify({ key, value }),
      }),
  },

  upload: async (file: File): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ url: string; filename: string }>("/upload", {
      method: "POST",
      body: formData,
    });
  },
};
