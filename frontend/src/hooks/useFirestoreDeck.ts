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

// Version management types
export type VersionType = 'auto' | 'manual'

export interface DeckVersion {
  id: string
  versionNumber: number
  type: VersionType
  name: string | null
  deck: DeckCard[]
  leader: LeaderCard | null
  deckCount: number
  createdAt: Timestamp
  description?: string
}

export interface DeckVersionInfo {
  id: string
  versionNumber: number
  type: VersionType
  name: string | null
  deckCount: number
  createdAt: string
  description?: string
}

// Version limits
const MAX_AUTO_VERSIONS = 20
const MAX_MANUAL_VERSIONS = 50

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
    query,
    where,
    orderBy,
    limit,
    addDoc,
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
    query,
    where,
    orderBy,
    limit,
    addDoc,
  }
}

export function useFirestoreDeck() {
  const { user, isFirebaseEnabled } = useAuth()

  const fetchBranches = useCallback(async (): Promise<{
    branches: BranchInfo[]
    currentBranch: string
  }> => {
    if (!user) {
      return { branches: [], currentBranch: '' }
    }

    try {
      const { db, collection, doc, getDoc, getDocs } =
        await getFirestoreFunctions()

      const branchesRef = collection(db, 'users', user.uid, 'branches')
      const snapshot = await getDocs(branchesRef)

      const branches: BranchInfo[] = []
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Branch
        // 「main」ブランチは一覧に表示しない
        if (data.name === 'main') return
        const deckCount = data.deck?.reduce((sum, card) => sum + card.count, 0) || 0
        branches.push({
          name: data.name,
          parent: data.parent,
          deck_count: deckCount,
          created_at: data.createdAt?.toDate().toISOString() || '',
          updated_at: data.updatedAt?.toDate().toISOString() || '',
        })
      })

      // 現在のブランチを取得（mainは無視）
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'general')
      const settingsSnap = await getDoc(settingsRef)
      const savedBranch = settingsSnap.exists() ? settingsSnap.data().currentBranch : null
      const currentBranch = savedBranch && savedBranch !== 'main' ? savedBranch : ''

      return { branches, currentBranch }
    } catch (error) {
      console.error('Failed to fetch branches:', error)
      return { branches: [], currentBranch: '' }
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

      const { db, collection, doc, getDoc, setDoc, deleteDoc, getDocs } =
        await getFirestoreFunctions()

      const branchesRef = collection(db, 'users', user.uid, 'branches')
      const branchRef = doc(branchesRef, name)

      // Delete all versions in the branch's subcollection
      const versionsRef = collection(branchRef, 'versions')
      const versionsSnap = await getDocs(versionsRef)
      for (const versionDoc of versionsSnap.docs) {
        await deleteDoc(versionDoc.ref)
      }

      await deleteDoc(branchRef)

      // 削除したブランチが現在のブランチなら設定をクリア
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'general')
      const settingsSnap = await getDoc(settingsRef)
      if (settingsSnap.exists() && settingsSnap.data().currentBranch === name) {
        await setDoc(settingsRef, { currentBranch: null }, { merge: true })
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

  // Get the next version number for a branch
  const getNextVersionNumber = useCallback(
    async (branchName: string): Promise<number> => {
      if (!user) return 1

      const { db, collection, query, orderBy, limit, getDocs } =
        await getFirestoreFunctions()

      const versionsRef = collection(
        db,
        'users',
        user.uid,
        'branches',
        branchName,
        'versions'
      )
      const q = query(versionsRef, orderBy('versionNumber', 'desc'), limit(1))
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        return 1
      }

      const lastVersion = snapshot.docs[0].data()
      return (lastVersion.versionNumber || 0) + 1
    },
    [user]
  )

  // Create a version (auto or manual)
  const createVersion = useCallback(
    async (
      branchName: string,
      deck: DeckCard[],
      leader: LeaderCard | null,
      type: VersionType,
      name?: string,
      description?: string
    ): Promise<string> => {
      if (!user) throw new Error('User not authenticated')

      const { db, collection, addDoc, serverTimestamp } =
        await getFirestoreFunctions()

      const versionNumber = await getNextVersionNumber(branchName)
      const deckCount = deck.reduce((sum, card) => sum + card.count, 0)

      // Clean objects for Firestore
      const cleanObject = <T extends object>(obj: T): T => {
        return JSON.parse(JSON.stringify(obj))
      }

      const cleanDeck = deck.map((card) => cleanObject(card))
      const cleanLeader = leader ? cleanObject(leader) : null

      const versionsRef = collection(
        db,
        'users',
        user.uid,
        'branches',
        branchName,
        'versions'
      )

      const versionDoc = await addDoc(versionsRef, {
        versionNumber,
        type,
        name: name || null,
        deck: cleanDeck,
        leader: cleanLeader,
        deckCount,
        createdAt: serverTimestamp(),
        description: description || null,
      })

      return versionDoc.id
    },
    [user, getNextVersionNumber]
  )

  // Prune old versions to maintain limits
  const pruneVersions = useCallback(
    async (
      branchName: string,
      maxAuto: number = MAX_AUTO_VERSIONS,
      maxManual: number = MAX_MANUAL_VERSIONS
    ): Promise<number> => {
      if (!user) return 0

      const { db, collection, getDocs, deleteDoc } =
        await getFirestoreFunctions()

      const versionsRef = collection(
        db,
        'users',
        user.uid,
        'branches',
        branchName,
        'versions'
      )

      // Get all versions and filter/sort in memory to avoid complex index requirements
      const allSnap = await getDocs(versionsRef)
      const allVersions = allSnap.docs.map((doc) => ({
        ref: doc.ref,
        data: doc.data() as { type: VersionType; createdAt: { toMillis: () => number } | null },
      }))

      let deletedCount = 0

      // Prune auto versions
      const autoVersions = allVersions
        .filter((v) => v.data.type === 'auto')
        .sort((a, b) => {
          const aTime = a.data.createdAt?.toMillis() || 0
          const bTime = b.data.createdAt?.toMillis() || 0
          return bTime - aTime // desc
        })

      if (autoVersions.length > maxAuto) {
        const toDelete = autoVersions.slice(maxAuto)
        for (const v of toDelete) {
          await deleteDoc(v.ref)
          deletedCount++
        }
      }

      // Prune manual versions
      const manualVersions = allVersions
        .filter((v) => v.data.type === 'manual')
        .sort((a, b) => {
          const aTime = a.data.createdAt?.toMillis() || 0
          const bTime = b.data.createdAt?.toMillis() || 0
          return bTime - aTime // desc
        })

      if (manualVersions.length > maxManual) {
        const toDelete = manualVersions.slice(maxManual)
        for (const v of toDelete) {
          await deleteDoc(v.ref)
          deletedCount++
        }
      }

      return deletedCount
    },
    [user]
  )

  const saveDeck = useCallback(
    async (
      branchName: string,
      deck: DeckCard[],
      leader: LeaderCard | null,
      options?: {
        createVersion?: boolean
        versionName?: string
        versionDescription?: string
      }
    ): Promise<void> => {
      if (!user) throw new Error('User not authenticated')

      const { db, collection, doc, setDoc, serverTimestamp } =
        await getFirestoreFunctions()

      // undefinedを除去してFirestoreに保存可能な形式に変換
      const cleanObject = <T extends object>(obj: T): T => {
        return JSON.parse(JSON.stringify(obj))
      }

      const cleanDeck = deck.map((card) => cleanObject(card))
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

      // Auto-create version after successful save
      if (options?.createVersion !== false) {
        const versionType: VersionType = options?.versionName ? 'manual' : 'auto'
        await createVersion(
          branchName,
          deck,
          leader,
          versionType,
          options?.versionName,
          options?.versionDescription
        )

        // Prune old versions to maintain limits
        await pruneVersions(branchName)
      }
    },
    [user, createVersion, pruneVersions]
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

  // Fetch versions for a branch
  const fetchVersions = useCallback(
    async (branchName: string, maxResults?: number): Promise<DeckVersionInfo[]> => {
      if (!user) return []

      try {
        const { db, collection, query, orderBy, limit, getDocs } =
          await getFirestoreFunctions()

        const versionsRef = collection(
          db,
          'users',
          user.uid,
          'branches',
          branchName,
          'versions'
        )

        let q = query(versionsRef, orderBy('createdAt', 'desc'))
        if (maxResults) {
          q = query(versionsRef, orderBy('createdAt', 'desc'), limit(maxResults))
        }

        const snapshot = await getDocs(q)
        const versions: DeckVersionInfo[] = []

        snapshot.forEach((docSnap) => {
          const data = docSnap.data()
          versions.push({
            id: docSnap.id,
            versionNumber: data.versionNumber,
            type: data.type,
            name: data.name,
            deckCount: data.deckCount,
            createdAt: data.createdAt?.toDate().toISOString() || '',
            description: data.description,
          })
        })

        return versions
      } catch (error) {
        console.error('Failed to fetch versions:', error)
        return []
      }
    },
    [user]
  )

  // Get a specific version's full data
  const getVersion = useCallback(
    async (branchName: string, versionId: string): Promise<DeckVersion | null> => {
      if (!user) return null

      try {
        const { db, doc, getDoc } = await getFirestoreFunctions()

        const versionRef = doc(
          db,
          'users',
          user.uid,
          'branches',
          branchName,
          'versions',
          versionId
        )
        const versionSnap = await getDoc(versionRef)

        if (!versionSnap.exists()) {
          return null
        }

        const data = versionSnap.data()
        return {
          id: versionSnap.id,
          versionNumber: data.versionNumber,
          type: data.type,
          name: data.name,
          deck: data.deck || [],
          leader: data.leader || null,
          deckCount: data.deckCount,
          createdAt: data.createdAt,
          description: data.description,
        }
      } catch (error) {
        console.error('Failed to get version:', error)
        return null
      }
    },
    [user]
  )

  // Restore a version (returns deck data for caller to apply)
  const restoreVersion = useCallback(
    async (
      branchName: string,
      versionId: string
    ): Promise<{ deck: DeckCard[]; leader: LeaderCard | null }> => {
      if (!user) throw new Error('User not authenticated')

      const version = await getVersion(branchName, versionId)
      if (!version) {
        throw new Error('Version not found')
      }

      return {
        deck: version.deck,
        leader: version.leader,
      }
    },
    [user, getVersion]
  )

  // Create a named snapshot (manual version)
  const createSnapshot = useCallback(
    async (
      branchName: string,
      name: string,
      description?: string
    ): Promise<string> => {
      if (!user) throw new Error('User not authenticated')

      // Get current deck state
      const { deck, leader } = await getDeck(branchName)

      // Create manual version
      const versionId = await createVersion(
        branchName,
        deck,
        leader,
        'manual',
        name,
        description
      )

      // Prune old versions
      await pruneVersions(branchName)

      return versionId
    },
    [user, getDeck, createVersion, pruneVersions]
  )

  // Delete a specific version
  const deleteVersion = useCallback(
    async (branchName: string, versionId: string): Promise<void> => {
      if (!user) throw new Error('User not authenticated')

      const { db, doc, deleteDoc } = await getFirestoreFunctions()

      const versionRef = doc(
        db,
        'users',
        user.uid,
        'branches',
        branchName,
        'versions',
        versionId
      )
      await deleteDoc(versionRef)
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
    // Version management
    fetchVersions,
    getVersion,
    restoreVersion,
    createSnapshot,
    deleteVersion,
  }
}
