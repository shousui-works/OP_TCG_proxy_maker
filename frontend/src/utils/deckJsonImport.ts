import type { Card, DeckCard } from '../types'
import type { DeckExportData } from './deckJsonExport'

// Constants
const SUPPORTED_VERSIONS = ['1.0']
const MAX_DECK_SIZE = 50
const MAX_COPIES = 4

// Types
export interface MissingCard {
  id: string
  name: string
  count: number
}

export interface ImportValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  parsedDeck?: {
    leader: Card | null
    cards: DeckCard[]
    missingCards: MissingCard[]
  }
}

/**
 * Parse and validate deck JSON
 */
export function parseDeckJson(jsonString: string): ImportValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Parse JSON
  let data: DeckExportData
  try {
    data = JSON.parse(jsonString)
  } catch {
    return {
      valid: false,
      errors: ['JSONの形式が正しくありません。'],
      warnings: [],
    }
  }

  // Version check
  if (!data.version || !SUPPORTED_VERSIONS.includes(data.version)) {
    return {
      valid: false,
      errors: [`サポートされていないバージョンです: ${data.version || '不明'}`],
      warnings: [],
    }
  }

  // Validate cards array
  if (!Array.isArray(data.cards)) {
    return {
      valid: false,
      errors: ['カードデータが見つかりません。'],
      warnings: [],
    }
  }

  // Validate card counts
  for (const card of data.cards) {
    if (!card.id || typeof card.count !== 'number') {
      errors.push(`無効なカードデータ: ${JSON.stringify(card)}`)
      continue
    }
    if (card.count < 1 || card.count > MAX_COPIES) {
      errors.push(`${card.name || card.id}: 枚数が不正です (${card.count})。1-${MAX_COPIES}枚の範囲で指定してください。`)
    }
  }

  // Validate total count
  const totalCount = data.cards.reduce((sum, c) => sum + (c.count || 0), 0)
  if (totalCount > MAX_DECK_SIZE) {
    errors.push(`デッキの合計枚数が${totalCount}枚です。最大${MAX_DECK_SIZE}枚までです。`)
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings }
  }

  // Return parsed data (cards will be resolved later with available cards)
  return {
    valid: true,
    errors: [],
    warnings,
    parsedDeck: {
      leader: null,
      cards: [],
      missingCards: [],
    },
  }
}

/**
 * Resolve cards from available cards
 */
export function resolveDeckCards(
  jsonString: string,
  availableCards: Card[]
): ImportValidationResult {
  // First parse and validate
  const parseResult = parseDeckJson(jsonString)
  if (!parseResult.valid) {
    return parseResult
  }

  const errors: string[] = []
  const warnings: string[] = []

  let data: DeckExportData
  try {
    data = JSON.parse(jsonString)
  } catch {
    return {
      valid: false,
      errors: ['JSONのパースに失敗しました。'],
      warnings: [],
    }
  }

  // Create card map for fast lookup
  const cardMap = new Map<string, Card>()
  for (const card of availableCards) {
    cardMap.set(card.id, card)
  }

  // Resolve deck cards
  const resolvedCards: DeckCard[] = []
  const missingCards: MissingCard[] = []

  for (const importCard of data.cards) {
    const systemCard = cardMap.get(importCard.id)
    if (systemCard) {
      resolvedCards.push({
        ...systemCard,
        count: importCard.count,
      })
    } else {
      missingCards.push({
        id: importCard.id,
        name: importCard.name || importCard.id,
        count: importCard.count,
      })
    }
  }

  if (missingCards.length > 0) {
    warnings.push(
      `${missingCards.length}枚のカードがシステムに存在しないためスキップされます:`
    )
    for (const card of missingCards) {
      warnings.push(`  - ${card.id} (${card.name}) x${card.count}`)
    }
  }

  // Resolve leader
  let resolvedLeader: Card | null = null
  if (data.leader) {
    const leaderCard = cardMap.get(data.leader.id)
    if (leaderCard) {
      if (leaderCard.card_type !== 'LEADER') {
        errors.push(`${leaderCard.name} はリーダーカードではありません。`)
      } else {
        resolvedLeader = leaderCard
      }
    } else {
      warnings.push(`リーダー ${data.leader.name || data.leader.id} がシステムに存在しません。`)
    }
  }

  // Check if any cards were resolved
  if (resolvedCards.length === 0 && !resolvedLeader) {
    return {
      valid: false,
      errors: ['インポートできるカードがありません。'],
      warnings,
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsedDeck: {
      leader: resolvedLeader,
      cards: resolvedCards,
      missingCards,
    },
  }
}
