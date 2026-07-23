import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CartItem, Product } from "@/types/store";
import { useAuth } from "@/contexts/AuthContext";
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from "@/services/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => {
    const local = localStorage.getItem("jr_cart_items");
    return local ? JSON.parse(local) : [];
  });
  const [isSyncLoaded, setIsSyncLoaded] = useState(false);

  // Load and merge cart from Firestore when user logs in
  useEffect(() => {
    const loadFirebaseCart = async () => {
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
            if (data.cart && Array.isArray(data.cart)) {
              // Combine existing local items with firestore items, preferring local quantities or merging
              const cloudCart = data.cart as CartItem[];
              setItems(cloudCart);
              localStorage.setItem("jr_cart_items", JSON.stringify(cloudCart));
            } else {
              // No cart in firestore yet, let's sync current local cart to Firestore initially
              await setDoc(userDocRef, { cart: items }, { merge: true });
            }
          } else {
            // First time user, seed their user profile document and sync any local items
            await setDoc(userDocRef, {
              id: user.uid,
              email: user.email,
              cart: items
            }, { merge: true });
          }
        }
      } catch (err) {
        console.warn("Could not sync/load cart from Firestore:", err);
      } finally {
        setIsSyncLoaded(true);
      }
    };

    loadFirebaseCart();
  }, [user]);

  // Persist local cart changes to localStorage and Firestore (if logged in)
  useEffect(() => {
    localStorage.setItem("jr_cart_items", JSON.stringify(items));

    if (isSyncLoaded && user && isFirebaseConfigured && db) {
      const saveFirebaseCart = async () => {
        try {
          const userDocRef = doc(db, "users", user.uid);
          await setDoc(userDocRef, { cart: items }, { merge: true });
        } catch (err) {
          console.error("Could not write cart update to Firestore:", err);
        }
      };
      saveFirebaseCart();
    }
  }, [items, user, isSyncLoaded]);

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};
