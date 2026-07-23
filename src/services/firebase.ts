import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Lazy/safe initialization variables
let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
export const isFirebaseConfigured = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);

if (isFirebaseConfigured) {
  try {
    if (getApps().length === 0) {
      appInstance = initializeApp(firebaseConfig);
    } else {
      appInstance = getApp();
    }
    // Set up database instance (use firestoreDatabaseId check)
    dbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId || undefined);
    authInstance = getAuth(appInstance);
    
    // Validate connection to Firestore on initialization
    const validate = async () => {
      try {
        if (dbInstance) {
          await getDocFromServer(doc(dbInstance, 'test', 'connection'));
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration: Client is offline.");
        }
      }
    };
    validate();
  } catch (error) {
    console.error("Erro initializing Firebase SDK:", error);
  }
}

// Fallback handles to avoid runtime null reference errors if Firebase configuration is pending
export const app = appInstance;
export const db = dbInstance as Firestore;
export const auth = authInstance as Auth;

/**
 * Standard Firestore permission/operation error handler mandated by instructions.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentAuth = authInstance;
  const currentUser = currentAuth?.currentUser;

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  console.error('Firestore Error Detailed Info: ', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}
