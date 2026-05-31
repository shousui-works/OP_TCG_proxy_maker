import { useCallback } from 'react'
import type { Timestamp } from 'firebase/firestore'
import { getDbInstance, initializeFirebase } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export interface ProxyListCard {
  id: string
  name: string
  image: string
  count: number
}

export interface ProxyList {
  name: string
  cards: ProxyListCard[]
  createdAt: string
  updatedAt: string
}

interface FirestoreProxyList {
  cards: ProxyListCard[]
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

// Helper to get Firestore functions lazily
async function getFirestoreFunctions() {
  await initializeFirebase()
  const db = getDbInstance()
  if (!db) throw new Error('Firestore not initialized')

  const {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    serverTimestamp,
  } = await import('firebase/firestore')

  return {
    db,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    serverTimestamp,
  }
}

export function useProxyList() {
  const { user, isFirebaseEnabled } = useAuth()
  const isAuthenticated = !!user && isFirebaseEnabled

  // Fetch all saved proxy lists
  const fetchLists = useCallback(async (): Promise<ProxyList[]> => {
    if (!user) return []

    try {
      const { db, collection, getDocs } = await getFirestoreFunctions()
      const listsRef = collection(db, 'users', user.uid, 'proxyLists')
      const snapshot = await getDocs(listsRef)

      const lists: ProxyList[] = []
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirestoreProxyList
        lists.push({
          name: docSnap.id,
          cards: data.cards || [],
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        })
      })

      // Sort by updatedAt descending
      lists.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

      return lists
    } catch (error) {
      console.error('Failed to fetch proxy lists:', error)
      throw error
    }
  }, [user])

  // Save a proxy list
  const saveList = useCallback(async (name: string, cards: ProxyListCard[]): Promise<void> => {
    if (!user) throw new Error('Not authenticated')

    try {
      const { db, doc, setDoc, serverTimestamp } = await getFirestoreFunctions()
      const listRef = doc(db, 'users', user.uid, 'proxyLists', name)

      await setDoc(listRef, {
        cards,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true })
    } catch (error) {
      console.error('Failed to save proxy list:', error)
      throw error
    }
  }, [user])

  // Load a specific proxy list
  const loadList = useCallback(async (name: string): Promise<ProxyList | null> => {
    if (!user) return null

    try {
      const { db, doc, getDoc } = await getFirestoreFunctions()
      const listRef = doc(db, 'users', user.uid, 'proxyLists', name)
      const docSnap = await getDoc(listRef)

      if (!docSnap.exists()) return null

      const data = docSnap.data() as FirestoreProxyList
      return {
        name: docSnap.id,
        cards: data.cards || [],
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      }
    } catch (error) {
      console.error('Failed to load proxy list:', error)
      throw error
    }
  }, [user])

  // Delete a proxy list
  const deleteList = useCallback(async (name: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated')

    try {
      const { db, doc, deleteDoc } = await getFirestoreFunctions()
      const listRef = doc(db, 'users', user.uid, 'proxyLists', name)
      await deleteDoc(listRef)
    } catch (error) {
      console.error('Failed to delete proxy list:', error)
      throw error
    }
  }, [user])

  return {
    isAuthenticated,
    fetchLists,
    saveList,
    loadList,
    deleteList,
  }
}
