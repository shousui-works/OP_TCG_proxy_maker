import { useCallback } from 'react'
import { getDbInstance, initializeFirebase } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import type { Match, LeaderCard, MatchResult, DeckVersionRef } from '../types'

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
    orderBy,
    addDoc,
    limit,
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
    orderBy,
    addDoc,
    limit,
  }
}

export function useMatches() {
  const { user, isFirebaseEnabled } = useAuth()

  const fetchMatches = useCallback(
    async (tournamentId: string): Promise<Match[]> => {
      if (!user) return []

      try {
        const { db, collection, getDocs, query, orderBy } =
          await getFirestoreFunctions()

        const matchesRef = collection(
          db,
          'users',
          user.uid,
          'tournaments',
          tournamentId,
          'matches'
        )
        const q = query(matchesRef, orderBy('order', 'asc'))
        const snapshot = await getDocs(q)

        return snapshot.docs.map((docSnap) => {
          const data = docSnap.data()
          return {
            id: docSnap.id,
            tournamentId,
            result: data.result as MatchResult,
            opponentLeader: data.opponentLeader || null,
            memo: data.memo || null,
            order: data.order || 0,
            createdAt: data.createdAt?.toDate() || new Date(),
            myDeckId: data.myDeckId || null,
            myDeckVersion: data.myDeckVersion || null,
            myLeader: data.myLeader || null,
          }
        })
      } catch (error) {
        console.error('Failed to fetch matches:', error)
        return []
      }
    },
    [user]
  )

  const createMatch = useCallback(
    async (
      tournamentId: string,
      data: {
        result: MatchResult
        opponentLeader?: LeaderCard
        memo?: string
        myDeckId?: string
        myDeckVersion?: DeckVersionRef
        myLeader?: LeaderCard
      }
    ): Promise<string> => {
      if (!user) throw new Error('User not authenticated')

      const { db, collection, getDocs, addDoc, serverTimestamp, query, orderBy, limit } =
        await getFirestoreFunctions()

      const matchesRef = collection(
        db,
        'users',
        user.uid,
        'tournaments',
        tournamentId,
        'matches'
      )

      // Get the current highest order number (only fetch 1 document)
      const q = query(matchesRef, orderBy('order', 'desc'), limit(1))
      const snapshot = await getDocs(q)
      const highestOrder = snapshot.empty ? 0 : snapshot.docs[0].data().order || 0

      const docRef = await addDoc(matchesRef, {
        result: data.result,
        opponentLeader: data.opponentLeader || null,
        memo: data.memo || null,
        order: highestOrder + 1,
        createdAt: serverTimestamp(),
        myDeckId: data.myDeckId || null,
        myDeckVersion: data.myDeckVersion || null,
        myLeader: data.myLeader || null,
      })

      return docRef.id
    },
    [user]
  )

  const updateMatch = useCallback(
    async (
      tournamentId: string,
      matchId: string,
      data: Partial<{
        result: MatchResult
        opponentLeader: LeaderCard | null
        memo: string | null
        myDeckId: string | null
        myDeckVersion: DeckVersionRef | null
        myLeader: LeaderCard | null
      }>
    ): Promise<void> => {
      if (!user) throw new Error('User not authenticated')

      const { db, doc, setDoc } = await getFirestoreFunctions()

      const matchRef = doc(
        db,
        'users',
        user.uid,
        'tournaments',
        tournamentId,
        'matches',
        matchId
      )

      const updateData: Record<string, unknown> = {}

      if (data.result !== undefined) updateData.result = data.result
      if (data.opponentLeader !== undefined) updateData.opponentLeader = data.opponentLeader
      if (data.memo !== undefined) updateData.memo = data.memo
      if (data.myDeckId !== undefined) updateData.myDeckId = data.myDeckId
      if (data.myDeckVersion !== undefined) updateData.myDeckVersion = data.myDeckVersion
      if (data.myLeader !== undefined) updateData.myLeader = data.myLeader

      await setDoc(matchRef, updateData, { merge: true })
    },
    [user]
  )

  const deleteMatch = useCallback(
    async (tournamentId: string, matchId: string): Promise<void> => {
      if (!user) throw new Error('User not authenticated')

      const { db, doc, deleteDoc } = await getFirestoreFunctions()

      const matchRef = doc(
        db,
        'users',
        user.uid,
        'tournaments',
        tournamentId,
        'matches',
        matchId
      )

      await deleteDoc(matchRef)
    },
    [user]
  )

  const getMatch = useCallback(
    async (tournamentId: string, matchId: string): Promise<Match | null> => {
      if (!user) return null

      try {
        const { db, doc, getDoc } = await getFirestoreFunctions()

        const matchRef = doc(
          db,
          'users',
          user.uid,
          'tournaments',
          tournamentId,
          'matches',
          matchId
        )
        const matchSnap = await getDoc(matchRef)

        if (!matchSnap.exists()) {
          return null
        }

        const data = matchSnap.data()
        return {
          id: matchSnap.id,
          tournamentId,
          result: data.result as MatchResult,
          opponentLeader: data.opponentLeader || null,
          memo: data.memo || null,
          order: data.order || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          myDeckId: data.myDeckId || null,
          myDeckVersion: data.myDeckVersion || null,
          myLeader: data.myLeader || null,
        }
      } catch (error) {
        console.error('Failed to get match:', error)
        return null
      }
    },
    [user]
  )

  return {
    isAuthenticated: !!user && isFirebaseEnabled,
    fetchMatches,
    createMatch,
    updateMatch,
    deleteMatch,
    getMatch,
  }
}
