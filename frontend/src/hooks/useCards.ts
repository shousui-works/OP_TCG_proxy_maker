/**
 * Hook for managing card data and filtering
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Card, Series } from '../types'
import { normalizeForSearch } from '../utils/textNormalize'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export interface CardFilters {
  searchQuery: string
  selectedSeries: string[]
  selectedColors: string[]
  selectedCardTypes: string[]
  selectedRarities: string[]
}

export interface UseCardsResult {
  cards: Card[]
  series: Series[]
  loading: boolean
  filteredCards: Card[]
  filters: CardFilters
  setSearchQuery: (query: string) => void
  setSelectedSeries: (series: string[]) => void
  setSelectedColors: (colors: string[]) => void
  setSelectedCardTypes: (types: string[]) => void
  setSelectedRarities: (rarities: string[]) => void
  toggleFilter: (
    current: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => void
  clearFilters: () => void
  hasActiveFilters: boolean
}

export function useCards(): UseCardsResult {
  const [cards, setCards] = useState<Card[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSeries, setSelectedSeries] = useState<string[]>([])
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedCardTypes, setSelectedCardTypes] = useState<string[]>([])
  const [selectedRarities, setSelectedRarities] = useState<string[]>([])

  // Load cards and series on mount
  useEffect(() => {
    const initCards = async () => {
      try {
        const [cardsRes, seriesRes, cardsDataRes] = await Promise.all([
          fetch(`${API_BASE}/api/cards`),
          fetch(`${API_BASE}/api/series`),
          fetch(`${API_BASE}/api/cards/data`),
        ])
        const cardsListData = await cardsRes.json()
        const seriesData = await seriesRes.json()
        const allCardsData = await cardsDataRes.json()

        const cardsWithDetails = cardsListData.cards.map((card: Card) => {
          const details = allCardsData.cards?.[card.id] || {}
          return {
            ...card,
            name: details.name || card.name,
            rarity: details.rarity,
            card_type: details.card_type,
            cost: details.cost,
            life: details.life,
            power: details.power,
            counter: details.counter,
            color: details.color,
            attribute: details.attribute,
            feature: details.feature,
          }
        })

        setCards(cardsWithDetails)
        setSeries(seriesData.series || [])
        setLoading(false)
      } catch (err) {
        console.error('Failed to initialize cards:', err)
        setLoading(false)
      }
    }
    initCards()
  }, [])

  // Toggle filter helper
  const toggleFilter = useCallback(
    (
      current: string[],
      setter: React.Dispatch<React.SetStateAction<string[]>>,
      value: string
    ) => {
      if (current.includes(value)) {
        setter(current.filter((v) => v !== value))
      } else {
        setter([...current, value])
      }
    },
    []
  )

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setSelectedSeries([])
    setSelectedColors([])
    setSelectedCardTypes([])
    setSelectedRarities([])
  }, [])

  // Check if any filters are active
  const hasActiveFilters = useMemo(
    () =>
      !!(
        searchQuery ||
        selectedSeries.length > 0 ||
        selectedColors.length > 0 ||
        selectedCardTypes.length > 0 ||
        selectedRarities.length > 0
      ),
    [searchQuery, selectedSeries, selectedColors, selectedCardTypes, selectedRarities]
  )

  // Filtered cards
  const filteredCards = useMemo(() => {
    // 検索クエリの正規化はループ外で1回だけ実行
    const normalizedQuery = searchQuery ? normalizeForSearch(searchQuery) : ''

    return cards.filter((card) => {
      if (
        selectedSeries.length > 0 &&
        !selectedSeries.includes(card.series_id || '')
      ) {
        return false
      }
      if (selectedColors.length > 0) {
        const hasColor = selectedColors.some((c) => card.color?.includes(c))
        if (!hasColor) return false
      }
      if (
        selectedCardTypes.length > 0 &&
        !selectedCardTypes.includes(card.card_type || '')
      ) {
        return false
      }
      if (
        selectedRarities.length > 0 &&
        !selectedRarities.includes(card.rarity || '')
      ) {
        return false
      }
      if (normalizedQuery) {
        const matchId = normalizeForSearch(card.id).includes(normalizedQuery)
        const matchName = normalizeForSearch(card.name || '').includes(normalizedQuery)

        if (!matchId && !matchName) return false
      }
      return true
    })
  }, [
    cards,
    selectedSeries,
    selectedColors,
    selectedCardTypes,
    selectedRarities,
    searchQuery,
  ])

  return {
    cards,
    series,
    loading,
    filteredCards,
    filters: {
      searchQuery,
      selectedSeries,
      selectedColors,
      selectedCardTypes,
      selectedRarities,
    },
    setSearchQuery,
    setSelectedSeries,
    setSelectedColors,
    setSelectedCardTypes,
    setSelectedRarities,
    toggleFilter,
    clearFilters,
    hasActiveFilters,
  }
}
