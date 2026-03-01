import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  isFirebaseConfigured,
  initializeFirebase,
  getAuthInstance,
  getGoogleProvider,
} from '../firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  isFirebaseEnabled: boolean
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [firebaseReady, setFirebaseReady] = useState(false)

  // Initialize Firebase lazily when user clicks login
  const ensureFirebaseReady = useCallback(async () => {
    if (firebaseReady) return true
    if (!isFirebaseConfigured) return false

    setLoading(true)
    try {
      await initializeFirebase()
      setFirebaseReady(true)

      // Set up auth state listener after initialization
      const auth = getAuthInstance()
      if (auth) {
        const { onAuthStateChanged } = await import('firebase/auth')
        onAuthStateChanged(auth, (user) => {
          setUser(user)
          setLoading(false)
        })
      }
      return true
    } catch (error) {
      console.error('Firebase initialization error:', error)
      setLoading(false)
      return false
    }
  }, [firebaseReady])

  // Check for existing auth state on mount (only if configured)
  useEffect(() => {
    if (!isFirebaseConfigured) return

    // Try to restore session - initialize Firebase in background
    let mounted = true
    ;(async () => {
      await initializeFirebase()
      if (!mounted) return

      const auth = getAuthInstance()
      if (auth) {
        const { onAuthStateChanged } = await import('firebase/auth')
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (mounted) {
            setUser(user)
            setFirebaseReady(true)
          }
        })
        return () => {
          mounted = false
          unsubscribe()
        }
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const ready = await ensureFirebaseReady()
    if (!ready) {
      console.error('Firebase is not configured')
      return
    }

    const auth = getAuthInstance()
    const googleProvider = getGoogleProvider()
    if (!auth || !googleProvider) {
      console.error('Firebase auth not initialized')
      return
    }

    try {
      const { signInWithPopup } = await import('firebase/auth')
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error('Google sign-in error:', error)
      throw error
    }
  }, [ensureFirebaseReady])

  const logout = useCallback(async () => {
    const auth = getAuthInstance()
    if (!auth) {
      console.error('Firebase is not configured')
      return
    }
    try {
      const { signOut } = await import('firebase/auth')
      await signOut(auth)
    } catch (error) {
      console.error('Sign-out error:', error)
      throw error
    }
  }, [])

  const value = {
    user,
    loading,
    isFirebaseEnabled: isFirebaseConfigured,
    signInWithGoogle,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
