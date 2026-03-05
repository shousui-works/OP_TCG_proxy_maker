import { useCallback } from 'react'
import { getDbInstance, initializeFirebase } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import type {
  Tournament,
  TournamentWithMatches,
  Match,
  LeaderCard,
  TournamentType,
  MatchResult,
  DeckVersionRef,
} from '../types'

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
    Timestamp,
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
    Timestamp,
  }
}

export function useTournaments() {
  const { user, isFirebaseEnabled } = useAuth()

  const fetchTournaments = useCallback(async (): Promise<TournamentWithMatches[]> => {
    if (!user) return []

    try {
      const { db, collection, getDocs, query, orderBy } = await getFirestoreFunctions()

      const tournamentsRef = collection(db, 'users', user.uid, 'tournaments')
      const q = query(tournamentsRef, orderBy('date', 'desc'))
      const snapshot = await getDocs(q)

      // Fetch all tournaments with their matches in parallel
      const tournaments = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data()

          // Fetch matches for this tournament
          const matchesRef = collection(docSnap.ref, 'matches')
          const matchesQuery = query(matchesRef, orderBy('order', 'asc'))
          const matchesSnap = await getDocs(matchesQuery)

          const matches: Match[] = matchesSnap.docs.map((matchDoc) => {
            const matchData = matchDoc.data()
            return {
              id: matchDoc.id,
              tournamentId: docSnap.id,
              result: matchData.result as MatchResult,
              opponentLeader: matchData.opponentLeader || null,
              memo: matchData.memo || null,
              order: matchData.order || 0,
              createdAt: matchData.createdAt?.toDate() || new Date(),
              myDeckId: matchData.myDeckId || null,
              myDeckVersion: matchData.myDeckVersion || null,
              myLeader: matchData.myLeader || null,
            }
          })

          const wins = matches.filter((m) => m.result === 'win').length
          const losses = matches.filter((m) => m.result === 'loss').length
          const draws = matches.filter((m) => m.result === 'draw').length
          const total = wins + losses + draws
          const winRate = total > 0 ? (wins / total) * 100 : 0

          return {
            id: docSnap.id,
            name: data.name,
            date: data.date?.toDate() || new Date(),
            type: data.type as TournamentType,
            customTypeName: data.customTypeName || null,
            myDeckId: data.myDeckId || null,
            myDeckVersion: data.myDeckVersion || null,
            myLeader: data.myLeader || null,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            matches,
            wins,
            losses,
            draws,
            winRate,
          } as TournamentWithMatches
        })
      )

      return tournaments
    } catch (error) {
      console.error('Failed to fetch tournaments:', error)
      return []
    }
  }, [user])

  const createTournament = useCallback(
    async (data: {
      name: string
      date: Date
      type: TournamentType
      customTypeName?: string
      myDeckId?: string | null
      myDeckVersion?: DeckVersionRef | null
      myLeader?: LeaderCard | null
    }): Promise<string> => {
      if (!user) throw new Error('User not authenticated')

      const { db, collection, addDoc, serverTimestamp, Timestamp } =
        await getFirestoreFunctions()

      const tournamentsRef = collection(db, 'users', user.uid, 'tournaments')

      const docRef = await addDoc(tournamentsRef, {
        name: data.name,
        date: Timestamp.fromDate(data.date),
        type: data.type,
        customTypeName: data.customTypeName || null,
        myDeckId: data.myDeckId || null,
        myDeckVersion: data.myDeckVersion || null,
        myLeader: data.myLeader || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      return docRef.id
    },
    [user]
  )

  const updateTournament = useCallback(
    async (
      tournamentId: string,
      data: Partial<{
        name: string
        date: Date
        type: TournamentType
        customTypeName: string | null
        myDeckId: string | null
        myDeckVersion: DeckVersionRef | null
        myLeader: LeaderCard | null
      }>
    ): Promise<void> => {
      if (!user) throw new Error('User not authenticated')

      const { db, doc, setDoc, serverTimestamp, Timestamp } =
        await getFirestoreFunctions()

      const tournamentRef = doc(db, 'users', user.uid, 'tournaments', tournamentId)

      const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      }

      if (data.name !== undefined) updateData.name = data.name
      if (data.date !== undefined) updateData.date = Timestamp.fromDate(data.date)
      if (data.type !== undefined) updateData.type = data.type
      if (data.customTypeName !== undefined) updateData.customTypeName = data.customTypeName
      if (data.myDeckId !== undefined) updateData.myDeckId = data.myDeckId
      if (data.myDeckVersion !== undefined) updateData.myDeckVersion = data.myDeckVersion
      if (data.myLeader !== undefined) updateData.myLeader = data.myLeader

      await setDoc(tournamentRef, updateData, { merge: true })
    },
    [user]
  )

  const deleteTournament = useCallback(
    async (tournamentId: string): Promise<void> => {
      if (!user) throw new Error('User not authenticated')

      const { db, doc, collection, getDocs, deleteDoc } =
        await getFirestoreFunctions()

      const tournamentRef = doc(db, 'users', user.uid, 'tournaments', tournamentId)

      // Delete all matches in the tournament
      const matchesRef = collection(tournamentRef, 'matches')
      const matchesSnap = await getDocs(matchesRef)
      for (const matchDoc of matchesSnap.docs) {
        await deleteDoc(matchDoc.ref)
      }

      // Delete the tournament
      await deleteDoc(tournamentRef)
    },
    [user]
  )

  const getTournament = useCallback(
    async (tournamentId: string): Promise<Tournament | null> => {
      if (!user) return null

      try {
        const { db, doc, getDoc } = await getFirestoreFunctions()

        const tournamentRef = doc(db, 'users', user.uid, 'tournaments', tournamentId)
        const tournamentSnap = await getDoc(tournamentRef)

        if (!tournamentSnap.exists()) {
          return null
        }

        const data = tournamentSnap.data()
        return {
          id: tournamentSnap.id,
          name: data.name,
          date: data.date?.toDate() || new Date(),
          type: data.type as TournamentType,
          customTypeName: data.customTypeName || null,
          myDeckId: data.myDeckId || null,
          myDeckVersion: data.myDeckVersion || null,
          myLeader: data.myLeader || null,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        }
      } catch (error) {
        console.error('Failed to get tournament:', error)
        return null
      }
    },
    [user]
  )

  return {
    isAuthenticated: !!user && isFirebaseEnabled,
    fetchTournaments,
    createTournament,
    updateTournament,
    deleteTournament,
    getTournament,
  }
}
