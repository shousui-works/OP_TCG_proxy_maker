import type { FirebaseApp } from 'firebase/app'
import type { Auth, GoogleAuthProvider } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Firebase設定が有効かチェック
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your-api-key' &&
  firebaseConfig.projectId
)

// Lazy-loaded Firebase instances
let app: FirebaseApp | null = null
let auth: Auth | null = null
let googleProvider: GoogleAuthProvider | null = null
let db: Firestore | null = null
let initPromise: Promise<void> | null = null

/**
 * Initialize Firebase lazily (only when needed)
 * Returns a promise that resolves when Firebase is ready
 */
export async function initializeFirebase(): Promise<{
  auth: Auth | null
  googleProvider: GoogleAuthProvider | null
  db: Firestore | null
}> {
  if (!isFirebaseConfigured) {
    return { auth: null, googleProvider: null, db: null }
  }

  // Return cached instances if already initialized
  if (auth && googleProvider && db) {
    return { auth, googleProvider, db }
  }

  // Prevent multiple parallel initializations
  if (!initPromise) {
    initPromise = (async () => {
      const [
        { initializeApp },
        { getAuth, GoogleAuthProvider: GP },
        { getFirestore }
      ] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore')
      ])

      app = initializeApp(firebaseConfig)
      auth = getAuth(app)
      googleProvider = new GP()
      db = getFirestore(app)
    })()
  }

  try {
    await initPromise
  } catch (error) {
    // Reset initPromise to allow retry on failure
    initPromise = null
    throw error
  }
  return { auth, googleProvider, db }
}

// Synchronous getters for already-initialized instances
export function getAuthInstance(): Auth | null {
  return auth
}

export function getGoogleProvider(): GoogleAuthProvider | null {
  return googleProvider
}

export function getDbInstance(): Firestore | null {
  return db
}
