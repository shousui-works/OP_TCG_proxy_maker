import { useCallback } from 'react'
import type { Timestamp } from 'firebase/firestore'
import { getDbInstance, initializeFirebase } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export interface DeckCard {
  id: string
  name: string
  image: string
  count: number
}

export interface LeaderCard {
  id: string
  name: string
  image: string
  color?: string
}

export interface Branch {
  name: string
  deck: DeckCard[]
  leader: LeaderCard | null
  parent: string | null
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface BranchInfo {
  name: string
  parent: string | null
  deck_count: number
  created_at: string
  updated_at: string
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

  return { db, collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp }
}

export function useFirestoreDeck() {
  const { user, isFirebaseEnabled } = useAuth()

  const fetchBranches = useCallback(async (): Promise<{
    branches: BranchInfo[]
    currentBranch: string
  }> => {
    if (!user) {
      return { branches: [], currentBranch: 'main' }
    }

    try {
      const { db, collection, doc, getDoc, getDocs, setDoc, serverTimestamp } =
        await getFirestoreFunctions()

      const branchesRef = collection(db, 'users', user.uid, 'branches')
      const snapshot = await getDocs(branchesRef)

      const branches: BranchInfo[] = []
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Branch
        const deckCount = data.deck?.reduce((sum, card) => sum + card.count, 0) || 0
        branches.push({
          name: data.name,
          parent: data.parent,
          deck_count: deckCount,
          created_at: data.createdAt?.toDate().toISOString() || '',
          updated_at: data.updatedAt?.toDate().toISOString() || '',
        })
      })

      // mainブランチがなければ作成
      if (!branches.find((b) => b.name === 'main')) {
        const newBranchRef = doc(branchesRef, 'main')
        await setDoc(newBranchRef, {
          name: 'main',
          deck: [],
          leader: null,
          parent: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        branches.push({
          name: 'main',
          parent: null,
          deck_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }

      // 現在のブランチを取得
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'general')
      const settingsSnap = await getDoc(settingsRef)
      const currentBranch = settingsSnap.exists()
        ? settingsSnap.data().currentBranch || 'main'
        : 'main'

      return { branches, currentBranch }
    } catch (error) {
      console.error('Failed to fetch branches:', error)
      return { branches: [], currentBranch: 'main' }
    }
  }, [user])

  const createBranch = useCallback(
    async (name: string, fromBranch: string | null): Promise<void> => {
      if (!user) throw new Error('User not authenticated')

      const { db, collection, doc, getDoc, setDoc, serverTimestamp } =
        await getFirestoreFunctions()

      const branchesRef = collection(db, 'users', user.uid, 'branches')
      const newBranchRef = doc(branchesRef, name)

      let parentDeck: DeckCard[] = []
      let parentLeader: LeaderCard | null = null

      if (fromBranch) {
        const parentRef = doc(branchesRef, fromBranch)
        const parentSnap = await getDoc(parentRef)
        if (parentSnap.exists()) {
          const parentData = parentSnap.data() as Branch
          parentDeck = parentData.deck || []
          parentLeader = parentData.leader || null
        }
      }

      await setDoc(newBranchRef, {
        name,
        deck: parentDeck,
        leader: parentLeader,
        parent: fromBranch,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    },
    [user]
  )

  const deleteBranch = useCallback(
    async (name: string): Promise<void> => {
      if (!user) throw new Error('User not authenticated')
      if (name === 'main') throw new Error('Cannot delete main branch')

      const { db, collection, doc, getDoc, setDoc, deleteDoc } =
        await getFirestoreFunctions()

      const branchesRef = collection(db, 'users', user.uid, 'branches')
      const branchRef = doc(branchesRef, name)
      await deleteDoc(branchRef)

      // 削除したブランチが現在のブランチならmainに切り替え
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'general')
      const settingsSnap = await getDoc(settingsRef)
      if (settingsSnap.exists() && settingsSnap.data().currentBranch === name) {
        await setDoc(settingsRef, { currentBranch: 'main' }, { merge: true })
      }
    },
    [user]
  )

  const checkoutBranch = useCallback(
    async (name: string): Promise<{ deck: DeckCard[]; leader: LeaderCard | null }> => {
      if (!user) throw new Error('User not authenticated')

      const { db, collection, doc, getDoc, setDoc } = await getFirestoreFunctions()

      const branchesRef = collection(db, 'users', user.uid, 'branches')
      const branchRef = doc(branchesRef, name)
      const branchSnap = await getDoc(branchRef)

      if (!branchSnap.exists()) {
        throw new Error('Branch not found')
      }

      const data = branchSnap.data() as Branch

      // 現在のブランチを更新
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'general')
      await setDoc(settingsRef, { currentBranch: name }, { merge: true })

      return {
        deck: data.deck || [],
        leader: data.leader || null,
      }
    },
    [user]
  )

  const saveDeck = useCallback(
    async (
      branchName: string,
      deck: DeckCard[],
      leader: LeaderCard | null
    ): Promise<void> => {
      if (!user) throw new Error('User not authenticated')

      const { db, collection, doc, setDoc, serverTimestamp } =
        await getFirestoreFunctions()

      // undefinedを除去してFirestoreに保存可能な形式に変換
      const cleanObject = <T extends object>(obj: T): T => {
        return JSON.parse(JSON.stringify(obj))
      }

      const cleanDeck = deck.map(card => cleanObject(card))
      const cleanLeader = leader ? cleanObject(leader) : null

      const branchesRef = collection(db, 'users', user.uid, 'branches')
      const branchRef = doc(branchesRef, branchName)
      await setDoc(
        branchRef,
        {
          name: branchName,
          deck: cleanDeck,
          leader: cleanLeader,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    },
    [user]
  )

  const getDeck = useCallback(
    async (branchName: string): Promise<{ deck: DeckCard[]; leader: LeaderCard | null }> => {
      if (!user) throw new Error('User not authenticated')

      const { db, collection, doc, getDoc } = await getFirestoreFunctions()

      const branchesRef = collection(db, 'users', user.uid, 'branches')
      const branchRef = doc(branchesRef, branchName)
      const branchSnap = await getDoc(branchRef)

      if (!branchSnap.exists()) {
        return { deck: [], leader: null }
      }

      const data = branchSnap.data() as Branch
      return {
        deck: data.deck || [],
        leader: data.leader || null,
      }
    },
    [user]
  )

  const mergeBranches = useCallback(
    async (source: string, target: string): Promise<void> => {
      if (!user) throw new Error('User not authenticated')

      const { db, collection, doc, getDoc, setDoc, serverTimestamp } =
        await getFirestoreFunctions()

      const branchesRef = collection(db, 'users', user.uid, 'branches')
      const sourceRef = doc(branchesRef, source)
      const sourceSnap = await getDoc(sourceRef)

      if (!sourceSnap.exists()) {
        throw new Error('Source branch not found')
      }

      const sourceData = sourceSnap.data() as Branch

      const targetRef = doc(branchesRef, target)
      await setDoc(
        targetRef,
        {
          deck: sourceData.deck,
          leader: sourceData.leader,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    },
    [user]
  )

  return {
    isAuthenticated: !!user && isFirebaseEnabled,
    fetchBranches,
    createBranch,
    deleteBranch,
    checkoutBranch,
    saveDeck,
    getDeck,
    mergeBranches,
  }
}
