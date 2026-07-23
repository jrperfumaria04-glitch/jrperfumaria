import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { StoreConfig, Banner, Category, Product, FooterConfig } from "@/types/store";
import { mockProducts, mockCategories, defaultBanners } from "@/data/mockData";
import { api } from "@/services/api";
import { toast } from "sonner";
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from "@/services/firebase";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const defaultFooter: FooterConfig = {
  storeName: "JR Perfumaria",
  description: "As melhores fragrâncias para todos os momentos da sua vida.",
  email: "contato@jrperfumaria.com",
  whatsappDisplay: "(00) 00000-0000",
  copyright: "© 2026 JR Perfumaria. Todos os direitos reservados.",
  address: "Av. Brasil, 1200 - Centro, Passo Fundo - RS, 99010-001",
  mapEmbedUrl: "https://www.google.com/maps?q=-28.16343879699707,-51.93328857421875&z=17&hl=pt-PT",
  instagramUrl: "https://instagram.com/jrperfumaria",
  facebookUrl: "https://facebook.com/jrperfumaria",
};

const defaultConfig: StoreConfig = {
  logoUrl: "default",
  storeName: "JR Perfumaria",
  whatsappNumber: "5554991407378",
  promoMessage: "Frete Grátis para todo o Brasil em compras acima de R$ 499;Descubra nossa coleção exclusiva de perfumes importados;Fragrâncias selecionadas com até 30% de desconto",
  banners: defaultBanners,
  categories: mockCategories,
  products: mockProducts,
  footer: defaultFooter,
};

interface StoreConfigContextType {
  config: StoreConfig;
  loading: boolean;
  updateStoreName: (name: string) => void;
  updateLogoUrl: (url: string) => void;
  updateWhatsappNumber: (number: string) => void;
  updateFooter: (footer: FooterConfig) => void;
  updatePromoMessage: (message: string) => void;
  addBanner: (banner: Omit<Banner, "id">) => void;
  updateBanner: (id: string, banner: Partial<Banner>) => void;
  removeBanner: (id: string) => void;
  addCategory: (category: Omit<Category, "id">) => void;
  updateCategory: (id: string, category: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  addProduct: (product: Omit<Product, "id">) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  removeProduct: (id: string) => void;
}

const StoreConfigContext = createContext<StoreConfigContextType | undefined>(undefined);

const cleanUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)).filter(item => item !== undefined);
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const clean: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        clean[key] = cleanUndefined(obj[key]);
      }
    }
    return clean;
  }
  return obj;
};

const normalizeImageUrl = (url: string): string => {
  if (!url) return "";
  const uploadsIndex = url.indexOf("/uploads/");
  if (uploadsIndex !== -1) {
    return url.substring(uploadsIndex);
  }
  return url;
};

export const StoreConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<StoreConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  // Load from Express API (Cloudflare D1 / server) or Firebase Firestore on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        let loadedFromApi = false;

        // Try Express backend API (which integrates directly with Cloudflare D1)
        if (API_URL) {
          try {
            const [products, categories, banners, settingsRaw] = await Promise.all([
              api.products.getAll(),
              api.categories.getAll(),
              api.banners.getAll(),
              api.settings.get(),
            ]);

            const settings: Record<string, string> = {};
            if (Array.isArray(settingsRaw)) {
              settingsRaw.forEach((s) => {
                settings[s.key] = s.key === "logoUrl" ? normalizeImageUrl(s.value) : s.value;
              });
            }

            const footer: FooterConfig = settings.footer
              ? JSON.parse(settings.footer)
              : defaultFooter;

            const migratedProducts = (products || []).map(p => ({ ...p, image: normalizeImageUrl(p.image || "") }));
            const migratedBanners = (banners || []).map(b => ({ ...b, image: normalizeImageUrl(b.image || "") }));

            setConfig({
              logoUrl: settings.logoUrl || defaultConfig.logoUrl,
              storeName: settings.storeName || defaultConfig.storeName,
              whatsappNumber: settings.whatsappNumber || defaultConfig.whatsappNumber,
              promoMessage: settings.promoMessage || defaultConfig.promoMessage,
              banners: migratedBanners.length ? migratedBanners : defaultBanners,
              categories: categories.length ? categories : mockCategories,
              products: migratedProducts.length ? migratedProducts : mockProducts,
              footer,
            });

            loadedFromApi = true;
          } catch (apiErr) {
            console.warn("Express API load failed, trying Firebase fallback:", apiErr);
          }
        }

        if (!loadedFromApi && isFirebaseConfigured && db) {
          // Fetch from Firestore
          const [productsSnap, categoriesSnap, bannersSnap, settingsSnap] = await Promise.all([
            getDocs(collection(db, "products")).catch(err => handleFirestoreError(err, OperationType.LIST, "products")),
            getDocs(collection(db, "categories")).catch(err => handleFirestoreError(err, OperationType.LIST, "categories")),
            getDocs(collection(db, "banners")).catch(err => handleFirestoreError(err, OperationType.LIST, "banners")),
            getDocs(collection(db, "settings")).catch(err => handleFirestoreError(err, OperationType.LIST, "settings")),
          ]);

          let productsList: Product[] = [];
          productsSnap.forEach(snap => {
            const data = snap.data();
            const id = snap.id;
            productsList.push({
              id: data.id || id,
              name: String(data.name || ""),
              description: String(data.description || ""),
              price: typeof data.price === "number" ? data.price : (Number(data.price) || 0),
              image: normalizeImageUrl(String(data.image || "")),
              category: String(data.category || ""),
              subCategory1: data.subCategory1 !== undefined && data.subCategory1 !== null ? String(data.subCategory1) : undefined,
              subCategory2: data.subCategory2 !== undefined && data.subCategory2 !== null ? String(data.subCategory2) : undefined,
              categories: Array.isArray(data.categories) ? data.categories : [],
              brand: data.brand !== undefined && data.brand !== null ? String(data.brand) : undefined,
              featured: Boolean(data.featured),
              sku: data.sku !== undefined && data.sku !== null ? String(data.sku) : undefined,
              stock: typeof data.stock === "number" ? data.stock : (Number(data.stock) || 0),
              expirationDate: data.expirationDate !== undefined && data.expirationDate !== null ? String(data.expirationDate) : undefined,
            });
          });

          let categoriesList: Category[] = [];
          categoriesSnap.forEach(snap => {
            const data = snap.data();
            const id = snap.id;
            categoriesList.push({
              id: data.id || id,
              name: String(data.name || ""),
              slug: String(data.slug || ""),
              parentId: data.parentId !== undefined && data.parentId !== null ? String(data.parentId) : undefined,
              isBrand: data.isBrand !== undefined && data.isBrand !== null ? Boolean(data.isBrand) : undefined,
            });
          });

          let bannersList: Banner[] = [];
          bannersSnap.forEach(snap => {
            const data = snap.data();
            const id = snap.id;
            bannersList.push({
              id: data.id || id,
              image: normalizeImageUrl(String(data.image || "")),
              title: String(data.title || ""),
              subtitle: String(data.subtitle || ""),
              cta: String(data.cta || ""),
              active: Boolean(data.active),
              device: data.device || "all",
              opacity: typeof data.opacity === "number" ? data.opacity : undefined,
              overlayOpacity: typeof data.overlayOpacity === "number" ? data.overlayOpacity : undefined,
            });
          });

          const settings: Record<string, string> = {};
          settingsSnap.forEach(snap => {
            const data = snap.data();
            settings[data.key] = data.key === "logoUrl" ? normalizeImageUrl(data.value) : data.value;
          });

          let footer: FooterConfig = defaultFooter;
          if (settings.footer) {
            try {
              footer = JSON.parse(settings.footer);
            } catch (e) {
              console.warn("Failed to parse footer config from Firestore:", e);
              footer = defaultFooter;
            }
          }

          setConfig({
            logoUrl: settings.logoUrl || defaultConfig.logoUrl,
            storeName: settings.storeName || defaultConfig.storeName,
            whatsappNumber: settings.whatsappNumber || defaultConfig.whatsappNumber,
            promoMessage: settings.promoMessage || defaultConfig.promoMessage,
            banners: bannersList.length ? bannersList : defaultBanners,
            categories: categoriesList.length ? categoriesList : mockCategories,
            products: productsList.length ? productsList : mockProducts,
            footer,
          });
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Helper: if API is configured, run the API call; always update local state
  const withApi = useCallback(async (fn: () => Promise<void>) => {
    if (!API_URL) return;
    try {
      await fn();
    } catch (err) {
      console.error("Erro na API:", err);
    }
  }, []);

  const updateStoreName = useCallback((name: string) => {
    setConfig((prev) => ({ ...prev, storeName: name }));
    withApi(() => api.settings.upsert("storeName", name).then(() => {}));
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, "settings", "storeName"), { key: "storeName", value: name }).catch(e => console.warn(e));
    }
  }, [withApi]);

  const updateLogoUrl = useCallback((url: string) => {
    const cleanUrl = normalizeImageUrl(url);
    setConfig((prev) => ({ ...prev, logoUrl: cleanUrl }));
    withApi(() => api.settings.upsert("logoUrl", cleanUrl).then(() => {}));
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, "settings", "logoUrl"), { key: "logoUrl", value: cleanUrl }).catch(e => console.warn(e));
    }
  }, [withApi]);

  const updateWhatsappNumber = useCallback((number: string) => {
    setConfig((prev) => ({ ...prev, whatsappNumber: number }));
    withApi(() => api.settings.upsert("whatsappNumber", number).then(() => {}));
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, "settings", "whatsappNumber"), { key: "whatsappNumber", value: number }).catch(e => console.warn(e));
    }
  }, [withApi]);

  const updateFooter = useCallback((footer: FooterConfig) => {
    setConfig((prev) => ({ ...prev, footer }));
    withApi(() => api.settings.upsert("footer", JSON.stringify(footer)).then(() => {}));
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, "settings", "footer"), { key: "footer", value: JSON.stringify(footer) }).catch(e => console.warn(e));
    }
  }, [withApi]);

  const updatePromoMessage = useCallback((message: string) => {
    setConfig((prev) => ({ ...prev, promoMessage: message }));
    withApi(() => api.settings.upsert("promoMessage", message).then(() => {}));
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, "settings", "promoMessage"), { key: "promoMessage", value: message }).catch(e => console.warn(e));
    }
  }, [withApi]);

  // Banners
  const addBanner = useCallback((banner: Omit<Banner, "id">) => {
    const tempId = Date.now().toString();
    const cleanBanner = { ...banner, image: normalizeImageUrl(banner.image) };
    const newBanner: Banner = { ...cleanBanner, id: tempId };
    setConfig((prev) => ({ ...prev, banners: [...prev.banners, newBanner] }));
    
    withApi(async () => {
      const [created] = await api.banners.create(cleanBanner);
      if (created) {
        setConfig((prev) => ({
          ...prev,
          banners: prev.banners.map((b) => (b.id === tempId ? created : b)),
        }));
      }
    });

    if (isFirebaseConfigured && db) {
      setDoc(doc(db, "banners", tempId), cleanUndefined(newBanner)).catch(e => console.warn(e));
    }
  }, [withApi]);

  const updateBanner = useCallback((id: string, banner: Partial<Banner>) => {
    const cleanBanner = { ...banner };
    if (cleanBanner.image !== undefined) {
      cleanBanner.image = normalizeImageUrl(cleanBanner.image);
    }
    setConfig((prev) => ({
      ...prev,
      banners: prev.banners.map((b) => (b.id === id ? { ...b, ...cleanBanner } : b)),
    }));
    
    withApi(() => api.banners.update(id, cleanBanner).then(() => {}));

    if (isFirebaseConfigured && db) {
      setDoc(doc(db, "banners", id), cleanUndefined(cleanBanner), { merge: true }).catch(e => console.warn(e));
    }
  }, [withApi]);

  const removeBanner = useCallback((id: string) => {
    setConfig((prev) => ({ ...prev, banners: prev.banners.filter((b) => b.id !== id) }));
    withApi(() => api.banners.delete(id));
    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, "banners", id)).catch(e => console.warn(e));
    }
  }, [withApi]);

  // Categories
  const addCategory = useCallback((category: Omit<Category, "id">) => {
    const tempId = Date.now().toString();
    const newCategory: Category = { ...category, id: tempId };
    setConfig((prev) => ({ ...prev, categories: [...prev.categories, newCategory] }));
    
    withApi(async () => {
      const [created] = await api.categories.create(category);
      if (created) {
        setConfig((prev) => ({
          ...prev,
          categories: prev.categories.map((c) => (c.id === tempId ? created : c)),
        }));
      }
    });

    if (isFirebaseConfigured && db) {
      setDoc(doc(db, "categories", tempId), cleanUndefined(newCategory)).catch(e => console.warn(e));
    }
  }, [withApi]);

  const updateCategory = useCallback((id: string, category: Partial<Category>) => {
    setConfig((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, ...category } : c)),
    }));
    withApi(() => api.categories.update(id, category).then(() => {}));
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, "categories", id), cleanUndefined(category), { merge: true }).catch(e => console.warn(e));
    }
  }, [withApi]);

  const removeCategory = useCallback((id: string) => {
    setConfig((prev) => ({ ...prev, categories: prev.categories.filter((c) => c.id !== id) }));
    withApi(() => api.categories.delete(id));
    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, "categories", id)).catch(e => console.warn(e));
    }
  }, [withApi]);

  // Products
  const addProduct = useCallback((product: Omit<Product, "id">) => {
    const tempId = Date.now().toString();
    const cleanProduct = { ...product, image: normalizeImageUrl(product.image) };
    const newProduct: Product = { ...cleanProduct, id: tempId };
    setConfig((prev) => ({ ...prev, products: [...prev.products, newProduct] }));
    
    withApi(async () => {
      const [created] = await api.products.create(cleanProduct);
      if (created) {
        setConfig((prev) => ({
          ...prev,
          products: prev.products.map((p) => (p.id === tempId ? created : p)),
        }));
      }
    });

    if (isFirebaseConfigured && db) {
      setDoc(doc(db, "products", tempId), cleanUndefined(newProduct)).catch(e => console.warn(e));
    }
  }, [withApi]);

  const updateProduct = useCallback((id: string, product: Partial<Product>) => {
    const cleanProduct = { ...product };
    if (cleanProduct.image !== undefined) {
      cleanProduct.image = normalizeImageUrl(cleanProduct.image);
    }
    setConfig((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === id ? { ...p, ...cleanProduct } : p)),
    }));
    withApi(() => api.products.update(id, cleanProduct).then(() => {}));
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, "products", id), cleanUndefined(cleanProduct), { merge: true }).catch(e => console.warn(e));
    }
  }, [withApi]);

  const removeProduct = useCallback((id: string) => {
    setConfig((prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== id) }));
    withApi(() => api.products.delete(id));
    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, "products", id)).catch(e => console.warn(e));
    }
  }, [withApi]);

  return (
    <StoreConfigContext.Provider
      value={{
        config,
        loading,
        updateStoreName,
        updateLogoUrl,
        updateWhatsappNumber,
        updateFooter,
        updatePromoMessage,
        addBanner,
        updateBanner,
        removeBanner,
        addCategory,
        updateCategory,
        removeCategory,
        addProduct,
        updateProduct,
        removeProduct,
      }}
    >
      {children}
    </StoreConfigContext.Provider>
  );
};

export const useStoreConfig = () => {
  const context = useContext(StoreConfigContext);
  if (!context) throw new Error("useStoreConfig must be used within StoreConfigProvider");
  return context;
};
