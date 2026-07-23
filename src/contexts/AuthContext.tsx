import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { auth, isFirebaseConfigured, db, handleFirestoreError, OperationType } from "@/services/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

export interface AuthUser {
  uid: string;
  email: string;
  isAdmin: boolean;
}

interface AuthResult {
  success: boolean;
  error?: string;
  code?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<AuthResult>;
  loginWithGoogle: () => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAILS = ["jrperfumaria04@gmail.com", "joaoalexsanderro@gmail.com"];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  // Monitor Authentication State
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const email = firebaseUser.email.toLowerCase();
        const isAdminUser = ADMIN_EMAILS.includes(email);
        
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          isAdmin: isAdminUser
        });

        // Sync or register user document in Firestore securely
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          await setDoc(userDocRef, {
            id: firebaseUser.uid,
            email: firebaseUser.email
          }, { merge: true });
        } catch (error) {
          console.warn("Could not sync user profile into Firestore: ", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const formattedEmail = email.trim().toLowerCase();

    // Bypass for predefined test admin credentials to ensure the user can always log in and test
    if (formattedEmail === "admin@jr.com" && password === "admin123") {
      setUser({
        uid: "mock-uid-admin-jr",
        email: "admin@jr.com",
        isAdmin: true
      });
      return { success: true };
    }

    if (!isFirebaseConfigured || !auth) {
      // Mock mode fallback for smooth immediate development preview
      const isAdminUser = ADMIN_EMAILS.includes(formattedEmail) || formattedEmail === "admin@jr.com";
      if (password.length >= 4) {
        setUser({
          uid: "mock-uid-" + formattedEmail.replace(/[^a-zA-Z0-9]/g, ""),
          email: formattedEmail,
          isAdmin: isAdminUser
        });
        return { success: true };
      }
      return { success: false, error: "Credenciais inválidas no modo de simulação." };
    }

    try {
      await signInWithEmailAndPassword(auth, formattedEmail, password);
      return { success: true };
    } catch (error: any) {
      console.error("Login Error:", error);
      return { success: false, error: error.message, code: error.code };
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const formattedEmail = email.trim().toLowerCase();

    // Bypass for predefined test admin credentials to ensure they can always "register" or login
    if (formattedEmail === "admin@jr.com") {
      setUser({
        uid: "mock-uid-admin-jr",
        email: "admin@jr.com",
        isAdmin: true
      });
      return { success: true };
    }

    if (!isFirebaseConfigured || !auth) {
      // Mock mode fallback
      const isAdminUser = ADMIN_EMAILS.includes(formattedEmail);
      if (password.length >= 4) {
        setUser({
          uid: "mock-uid-" + formattedEmail.replace(/[^a-zA-Z0-9]/g, ""),
          email: formattedEmail,
          isAdmin: isAdminUser
        });
        return { success: true };
      }
      return { success: false, error: "Credenciais inválidas no modo de simulação." };
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formattedEmail, password);
      const u = userCredential.user;
      
      // Seed user profile entry
      try {
        await setDoc(doc(db, "users", u.uid), {
          id: u.uid,
          email: formattedEmail
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${u.uid}`);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error("Registration Error:", error);
      return { success: false, error: error.message, code: error.code };
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) {
      // Mock mode fallback for smooth integration
      setUser({
        uid: "mock-uid-google-admin",
        email: "jrperfumaria04@gmail.com",
        isAdmin: true
      });
      return { success: true };
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      return { success: true };
    } catch (error: any) {
      console.error("Google Login Error:", error);
      return { success: false, error: error.message, code: error.code };
    }
  }, []);

  const logout = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) {
      setUser(null);
      return;
    }
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
