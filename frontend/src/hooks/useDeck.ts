/**
 * Hook for managing deck state
 */

import { useState, useCallback, useMemo } from 'react'
import type { Card, DeckCard } from '../types'

const MAX_DECK_SIZE = 50
const MAX_COPIES = 4
const COLORS = ['赤', '緑', '青', '紫', '黒', '黄']

export interface UseDeckResult {
  deck: DeckCard[]
  leader: Card | null
  deckCount: number
  deckMap: Map<string, number>
  hasUnsavedChanges: boolean
  setDeck: React.Dispatch<React.SetStateAction<DeckCard[]>>
  setLeader: React.Dispatch<React.SetStateAction<Card | null>>
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>
  addToDeck: (card: Card, setSelectedColors?: (colors: string[]) => void) => void
  removeFromDeck: (cardId: string) => void
  setLeaderCard: (card: Card, setSelectedColors?: (colors: string[]) => void) => void
  removeLeader: () => void
  clearDeck: () => void
  getCardCount: (cardId: string) => number
  MAX_DECK_SIZE: number
  MAX_COPIES: number
}

export function useDeck(): UseDeckResult {
  const [deck, setDeck] = useState<DeckCard[]>([])
  const [leader, setLeader] = useState<Card | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const deckCount = useMemo(
    () => deck.reduce((sum, card) => sum + card.count, 0),
    [deck]
  )

  const deckMap = useMemo(
    () => new Map(deck.map((c) => [c.id, c.count])),
    [deck]
  )

  const getCardCount = useCallback(
    (cardId: string) => deckMap.get(cardId) || 0,
    [deckMap]
  )

  const setLeaderCard = useCallback(
    (card: Card, setSelectedColors?: (colors: string[]) => void) => {
      if (card.card_type !== 'LEADER') return
      setLeader(card)
      setHasUnsavedChanges(true)

      if (card.color && setSelectedColors) {
        const leaderColors = COLORS.filter((c) => card.color?.includes(c))
        if (leaderColors.length > 0) {
          setSelectedColors(leaderColors)
        }
      }
    },
    []
  )

  const removeLeader = useCallback(() => {
    setLeader(null)
    setHasUnsavedChanges(true)
  }, [])

  const addToDeck = useCallback(
    (card: Card, setSelectedColors?: (colors: string[]) => void) => {
      if (card.card_type === 'LEADER') {
        setLeaderCard(card, setSelectedColors)
        return
      }

      setDeck((prev) => {
        const existing = prev.find((c) => c.id === card.id)
        if (existing) {
          if (existing.count >= MAX_COPIES) return prev
          return prev.map((c) =>
            c.id === card.id ? { ...c, count: c.count + 1 } : c
          )
        }
        return [...prev, { ...card, count: 1 }]
      })
      setHasUnsavedChanges(true)
    },
    [setLeaderCard]
  )

  const removeFromDeck = useCallback((cardId: string) => {
    setDeck((prev) => {
      const existing = prev.find((c) => c.id === cardId)
      if (!existing) return prev
      if (existing.count === 1) {
        return prev.filter((c) => c.id !== cardId)
      }
      return prev.map((c) =>
        c.id === cardId ? { ...c, count: c.count - 1 } : c
      )
    })
    setHasUnsavedChanges(true)
  }, [])

  const clearDeck = useCallback(() => {
    setDeck([])
    setLeader(null)
    setHasUnsavedChanges(true)
  }, [])

  return {
    deck,
    leader,
    deckCount,
    deckMap,
    hasUnsavedChanges,
    setDeck,
    setLeader,
    setHasUnsavedChanges,
    addToDeck,
    removeFromDeck,
    setLeaderCard,
    removeLeader,
    clearDeck,
    getCardCount,
    MAX_DECK_SIZE,
    MAX_COPIES,
  }
}
