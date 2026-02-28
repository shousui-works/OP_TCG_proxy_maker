import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../firebase'

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
  const [loading, setLoading] = useState(isFirebaseConfigured)

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) {
      console.error('Firebase is not configured')
      return
    }
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error('Google sign-in error:', error)
      throw error
    }
  }

  const logout = async () => {
    if (!auth) {
      console.error('Firebase is not configured')
      return
    }
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Sign-out error:', error)
      throw error
    }
  }

  const value = {
    user,
    loading,
    isFirebaseEnabled: isFirebaseConfigured,
    signInWithGoogle,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
