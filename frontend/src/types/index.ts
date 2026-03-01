/**
 * Shared type definitions for OP-TCG base
 */

export interface Series {
  id: string
  name: string
}

export interface Card {
  id: string
  name: string
  image: string
  series_id?: string
  rarity?: string
  card_type?: string
  cost?: string
  life?: string
  power?: string
  counter?: string
  color?: string
  attribute?: string
  feature?: string
}

export interface DeckCard extends Card {
  count: number
}

export interface SavedDeck {
  name: string
  deck_count: number
  updated_at: string
}

export interface Branch {
  name: string
  parent: string | null
  deck_count: number
  created_at: string
  updated_at: string
}

export interface BranchesResponse {
  current_branch: string
  branches: Branch[]
}

export interface DeckResponse {
  deck: DeckCard[]
  leader: Card | null
}
