import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Product } from "@/types/store";
import { useAuth } from "@/contexts/AuthContext";
import { db, isFirebaseConfigured } from "@/services/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";

interface FavoritesContextType {
  favorites: Product[];
  addFavorite: (product: Product) => void;
  removeFavorite: (productId: string) => void;
  toggleFavorite: (product: Product) => void;
  isFavorite: (productId: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Product[]>(() => {
    const local = localStorage.getItem("jr_favorites_items");
    return local ? JSON.parse(local) : [];
  });
  const [isSyncLoaded, setIsSyncLoaded] = useState(false);

  // Load and merge favorites from Firestore when user logs in
  useEffect(() => {
    const loadFirebaseFavorites = async () => {
      if (!user) {
        setIsSyncLoaded(true);
        return;
      }

      setIsSyncLoaded(false);
      try {
        if (isFirebaseConfigured && db) {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.favorites && Array.isArray(data.favorites)) {
              const cloudFavorites = data.favorites as Product[];
              // Merge: combine both lists, keeping unique items by ID
              setFavorites((localFavs) => {
                const merged = [...localFavs];
                cloudFavorites.forEach((cf) => {
                  if (!merged.some((lf) => lf.id === cf.id)) {
                    merged.push(cf);
                  }
                });
                localStorage.setItem("jr_favorites_items", JSON.stringify(merged));
                return merged;
              });
            } else {
              // Sync current local favorites to Firestore initially
              await setDoc(userDocRef, { favorites }, { merge: true });
            }
          }
        }
      } catch (err) {
        console.warn("Could not sync/load favorites from Firestore:", err);
      } finally {
        setIsSyncLoaded(true);
      }
    };

    loadFirebaseFavorites();
  }, [user]);

  // Persist local favorites changes to localStorage and Firestore (if logged in)
  useEffect(() => {
    localStorage.setItem("jr_favorites_items", JSON.stringify(favorites));

    if (isSyncLoaded && user && isFirebaseConfigured && db) {
      const saveFirebaseFavorites = async () => {
        try {
          const userDocRef = doc(db, "users", user.uid);
          await setDoc(userDocRef, { favorites }, { merge: true });
        } catch (err) {
          console.error("Could not write favorites update to Firestore:", err);
        }
      };
      saveFirebaseFavorites();
    }
  }, [favorites, user, isSyncLoaded]);

  const addFavorite = useCallback((product: Product) => {
    setFavorites((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev;
      toast.success(`${product.name} adicionado aos favoritos!`, {
        icon: "❤️"
      });
      return [...prev, product];
    });
  }, []);

  const removeFavorite = useCallback((productId: string) => {
    setFavorites((prev) => {
      const product = prev.find((p) => p.id === productId);
      if (product) {
        toast.info(`${product.name} removido dos favoritos.`);
      }
      return prev.filter((p) => p.id !== productId);
    });
  }, []);

  const toggleFavorite = useCallback((product: Product) => {
    setFavorites((prev) => {
      const isFav = prev.some((p) => p.id === product.id);
      if (isFav) {
        toast.info(`${product.name} removido dos favoritos.`);
        return prev.filter((p) => p.id !== product.id);
      } else {
        toast.success(`${product.name} adicionado aos favoritos!`, {
          icon: "❤️"
        });
        return [...prev, product];
      }
    });
  }, []);

  const isFavorite = useCallback((productId: string) => {
    return favorites.some((p) => p.id === productId);
  }, [favorites]);

  return (
    <FavoritesContext.Provider
      value={{ favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used within FavoritesProvider");
  return context;
};
