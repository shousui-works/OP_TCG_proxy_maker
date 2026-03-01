import type { Card, DeckCard } from '../types'
import { generateFilename } from './filename'

// Types
export interface DeckExportData {
  version: string
  exportedAt: string
  deckName: string | null
  leader: { id: string; name: string } | null
  cards: Array<{ id: string; name: string; count: number }>
  metadata: {
    totalCards: number
    uniqueCards: number
  }
}

export interface ExportResult {
  success: boolean
  data?: string
  error?: string
}

// Constants
const EXPORT_VERSION = '1.0'

/**
 * Export deck to JSON format
 */
export function exportDeckToJson(
  deck: DeckCard[],
  leader: Card | null,
  deckName: string | null
): ExportResult {
  try {
    const totalCards = deck.reduce((sum, card) => sum + card.count, 0)

    const exportData: DeckExportData = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      deckName,
      leader: leader ? { id: leader.id, name: leader.name } : null,
      cards: deck.map(card => ({
        id: card.id,
        name: card.name,
        count: card.count,
      })),
      metadata: {
        totalCards,
        uniqueCards: deck.length,
      },
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    return { success: true, data: jsonString }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Copy deck JSON to clipboard
 */
export async function copyDeckToClipboard(jsonString: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(jsonString)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

/**
 * Download deck as JSON file
 */
export function downloadDeckAsJson(jsonString: string, deckName: string | null): void {
  // Generate filename: デッキ名_日付_deck.json
  const filename = generateFilename(deckName, 'deck', 'json')

  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
