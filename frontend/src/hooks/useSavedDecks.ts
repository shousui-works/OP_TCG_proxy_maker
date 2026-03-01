/**
 * Hook for managing saved decks
 */

import { useState, useCallback } from 'react'
import type { Card, DeckCard, SavedDeck } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useFirestoreDeck } from './useFirestoreDeck'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export interface UseSavedDecksResult {
  savedDecks: SavedDeck[]
  currentDeckName: string | null
  setCurrentDeckName: (name: string | null) => void
  fetchSavedDecks: () => Promise<void>
  loadDeck: (
    deckName: string,
    hasUnsavedChanges: boolean,
    setDeck: (deck: DeckCard[]) => void,
    setLeader: (leader: Card | null) => void,
    setHasUnsavedChanges: (hasChanges: boolean) => void
  ) => Promise<void>
  saveDeck: (
    deck: DeckCard[],
    leader: Card | null,
    setHasUnsavedChanges: (hasChanges: boolean) => void,
    openSaveAsModal: () => void
  ) => Promise<void>
  saveAsNewDeck: (
    newDeckName: string,
    deck: DeckCard[],
    leader: Card | null,
    setHasUnsavedChanges: (hasChanges: boolean) => void,
    onSuccess: () => void
  ) => Promise<void>
  deleteDeck: (
    deckName: string,
    currentDeckName: string | null,
    setDeck: (deck: DeckCard[]) => void,
    setLeader: (leader: Card | null) => void,
    setHasUnsavedChanges: (hasChanges: boolean) => void
  ) => Promise<void>
}

export function useSavedDecks(): UseSavedDecksResult {
  const { user } = useAuth()
  const firestore = useFirestoreDeck()

  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([])
  const [currentDeckName, setCurrentDeckName] = useState<string | null>(null)

  const fetchSavedDecks = useCallback(async () => {
    try {
      if (user && firestore.isAuthenticated) {
        const data = await firestore.fetchBranches()
        setSavedDecks(
          data.branches.map((b) => ({
            name: b.name,
            deck_count: b.deck_count,
            updated_at: b.updated_at,
          }))
        )
      } else {
        const res = await fetch(`${API_BASE}/api/branches`)
        const data = await res.json()
        setSavedDecks(
          data.branches.map((b: SavedDeck) => ({
            name: b.name,
            deck_count: b.deck_count,
            updated_at: b.updated_at,
          }))
        )
      }
    } catch (err) {
      console.error('Failed to fetch saved decks:', err)
    }
  }, [user, firestore])

  const loadDeck = useCallback(
    async (
      deckName: string,
      hasUnsavedChanges: boolean,
      setDeck: (deck: DeckCard[]) => void,
      setLeader: (leader: Card | null) => void,
      setHasUnsavedChanges: (hasChanges: boolean) => void
    ) => {
      if (hasUnsavedChanges) {
        if (
          !confirm('未保存の変更があります。破棄してデッキを読み込みますか？')
        ) {
          return
        }
      }

      try {
        if (user && firestore.isAuthenticated) {
          const data = await firestore.getDeck(deckName)
          setDeck(data.deck || [])
          setLeader(data.leader || null)
        } else {
          const res = await fetch(`${API_BASE}/api/deck/${deckName}`)
          const data = await res.json()
          setDeck(data.deck || [])
          setLeader(data.leader || null)
        }
        setCurrentDeckName(deckName)
        setHasUnsavedChanges(false)
      } catch (err) {
        console.error('Failed to load deck:', err)
      }
    },
    [user, firestore]
  )

  const saveDeck = useCallback(
    async (
      deck: DeckCard[],
      leader: Card | null,
      setHasUnsavedChanges: (hasChanges: boolean) => void,
      openSaveAsModal: () => void
    ) => {
      if (!currentDeckName) {
        openSaveAsModal()
        return
      }

      try {
        if (user && firestore.isAuthenticated) {
          await firestore.saveDeck(currentDeckName, deck, leader)
        } else {
          await fetch(`${API_BASE}/api/deck/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ branch: currentDeckName, deck, leader }),
          })
        }
        setHasUnsavedChanges(false)
        fetchSavedDecks()
      } catch (err) {
        console.error('Failed to save deck:', err)
      }
    },
    [currentDeckName, user, firestore, fetchSavedDecks]
  )

  const saveAsNewDeck = useCallback(
    async (
      newDeckName: string,
      deck: DeckCard[],
      leader: Card | null,
      setHasUnsavedChanges: (hasChanges: boolean) => void,
      onSuccess: () => void
    ) => {
      if (!newDeckName.trim()) return

      try {
        if (user && firestore.isAuthenticated) {
          await firestore.createBranch(newDeckName, null)
          await firestore.saveDeck(newDeckName, deck, leader)
        } else {
          await fetch(`${API_BASE}/api/branches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newDeckName, from_branch: null }),
          })
          await fetch(`${API_BASE}/api/deck/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ branch: newDeckName, deck, leader }),
          })
        }
        setCurrentDeckName(newDeckName)
        setHasUnsavedChanges(false)
        fetchSavedDecks()
        onSuccess()
      } catch (err) {
        console.error('Failed to save deck:', err)
      }
    },
    [user, firestore, fetchSavedDecks]
  )

  const deleteDeck = useCallback(
    async (
      deckName: string,
      currentName: string | null,
      setDeck: (deck: DeckCard[]) => void,
      setLeader: (leader: Card | null) => void,
      setHasUnsavedChanges: (hasChanges: boolean) => void
    ) => {
      if (!confirm(`デッキ "${deckName}" を削除しますか？`)) return

      try {
        if (user && firestore.isAuthenticated) {
          await firestore.deleteBranch(deckName)
        } else {
          await fetch(`${API_BASE}/api/branches/${deckName}`, {
            method: 'DELETE',
          })
        }
        fetchSavedDecks()
        if (currentName === deckName) {
          setCurrentDeckName(null)
          setDeck([])
          setLeader(null)
          setHasUnsavedChanges(false)
        }
      } catch (err) {
        console.error('Failed to delete deck:', err)
      }
    },
    [user, firestore, fetchSavedDecks]
  )

  return {
    savedDecks,
    currentDeckName,
    setCurrentDeckName,
    fetchSavedDecks,
    loadDeck,
    saveDeck,
    saveAsNewDeck,
    deleteDeck,
  }
}
