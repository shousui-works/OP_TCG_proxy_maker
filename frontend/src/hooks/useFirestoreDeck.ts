import { useCallback } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
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

export function useFirestoreDeck() {
  const { user, isFirebaseEnabled } = useAuth()

  const getBranchesCollection = useCallback(() => {
    if (!user) throw new Error('User not authenticated')
    if (!db) throw new Error('Firestore not initialized')
    return collection(db, 'users', user.uid, 'branches')
  }, [user])

  const getSettingsDoc = useCallback(() => {
    if (!user) throw new Error('User not authenticated')
    if (!db) throw new Error('Firestore not initialized')
    return doc(db, 'users', user.uid, 'settings', 'general')
  }, [user])

  const fetchBranches = useCallback(async (): Promise<{
    branches: BranchInfo[]
    currentBranch: string
  }> => {
    if (!user) {
      return { branches: [], currentBranch: 'main' }
    }

    try {
      const branchesRef = getBranchesCollection()
      const snapshot = await getDocs(branchesRef)

      const branches: BranchInfo[] = []
      snapshot.forEach((doc) => {
        const data = doc.data() as Branch
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
        await createBranch('main', null)
        branches.push({
          name: 'main',
          parent: null,
          deck_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }

      // 現在のブランチを取得
      const settingsRef = getSettingsDoc()
      const settingsSnap = await getDoc(settingsRef)
      const currentBranch = settingsSnap.exists()
        ? settingsSnap.data().currentBranch || 'main'
        : 'main'

      return { branches, currentBranch }
    } catch (error) {
      console.error('Failed to fetch branches:', error)
      return { branches: [], currentBranch: 'main' }
    }
  }, [user, getBranchesCollection, getSettingsDoc])

  const createBranch = useCallback(
    async (name: string, fromBranch: string | null): Promise<void> => {
      if (!user) throw new Error('User not authenticated')

      const branchesRef = getBranchesCollection()
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
    [user, getBranchesCollection]
  )

  const deleteBranch = useCallback(
    async (name: string): Promise<void> => {
      if (!user) throw new Error('User not authenticated')
      if (name === 'main') throw new Error('Cannot delete main branch')

      const branchRef = doc(getBranchesCollection(), name)
      await deleteDoc(branchRef)

      // 削除したブランチが現在のブランチならmainに切り替え
      const settingsRef = getSettingsDoc()
      const settingsSnap = await getDoc(settingsRef)
      if (settingsSnap.exists() && settingsSnap.data().currentBranch === name) {
        await setDoc(settingsRef, { currentBranch: 'main' }, { merge: true })
      }
    },
    [user, getBranchesCollection, getSettingsDoc]
  )

  const checkoutBranch = useCallback(
    async (name: string): Promise<{ deck: DeckCard[]; leader: LeaderCard | null }> => {
      if (!user) throw new Error('User not authenticated')

      const branchRef = doc(getBranchesCollection(), name)
      const branchSnap = await getDoc(branchRef)

      if (!branchSnap.exists()) {
        throw new Error('Branch not found')
      }

      const data = branchSnap.data() as Branch

      // 現在のブランチを更新
      const settingsRef = getSettingsDoc()
      await setDoc(settingsRef, { currentBranch: name }, { merge: true })

      return {
        deck: data.deck || [],
        leader: data.leader || null,
      }
    },
    [user, getBranchesCollection, getSettingsDoc]
  )

  const saveDeck = useCallback(
    async (
      branchName: string,
      deck: DeckCard[],
      leader: LeaderCard | null
    ): Promise<void> => {
      if (!user) throw new Error('User not authenticated')
      if (!db) throw new Error('Firestore not initialized')

      // undefinedを除去してFirestoreに保存可能な形式に変換
      const cleanObject = <T extends object>(obj: T): T => {
        return JSON.parse(JSON.stringify(obj))
      }

      const cleanDeck = deck.map(card => cleanObject(card))
      const cleanLeader = leader ? cleanObject(leader) : null

      const branchRef = doc(getBranchesCollection(), branchName)
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
    [user, getBranchesCollection]
  )

  const getDeck = useCallback(
    async (branchName: string): Promise<{ deck: DeckCard[]; leader: LeaderCard | null }> => {
      if (!user) throw new Error('User not authenticated')

      const branchRef = doc(getBranchesCollection(), branchName)
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
    [user, getBranchesCollection]
  )

  const mergeBranches = useCallback(
    async (source: string, target: string): Promise<void> => {
      if (!user) throw new Error('User not authenticated')

      const sourceRef = doc(getBranchesCollection(), source)
      const sourceSnap = await getDoc(sourceRef)

      if (!sourceSnap.exists()) {
        throw new Error('Source branch not found')
      }

      const sourceData = sourceSnap.data() as Branch

      const targetRef = doc(getBranchesCollection(), target)
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
    [user, getBranchesCollection]
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
