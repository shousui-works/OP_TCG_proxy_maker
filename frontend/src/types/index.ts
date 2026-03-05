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
  image_url?: string  // APIから返される画像URL（imageより優先）
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

// ===== Tournament Types =====

export type TournamentType = 'flagship' | 'standard_battle' | 'championship' | 'freeplay' | 'other'

export const TOURNAMENT_TYPE_LABELS: Record<TournamentType, string> = {
  flagship: 'フラッグシップ',
  standard_battle: 'スタンダードバトル',
  championship: 'チャンピオンシップ',
  freeplay: 'フリープレイ',
  other: 'その他',
}

export type MatchResult = 'win' | 'loss' | 'draw'

export const MATCH_RESULT_LABELS: Record<MatchResult, string> = {
  win: '勝ち',
  loss: '負け',
  draw: '引き分け',
}

export interface LeaderCard {
  id: string
  name: string
  image: string
  color?: string
  series_id?: string
}

export interface DeckVersionRef {
  versionId: string
  versionNumber: number
  versionName: string | null
}

export interface Tournament {
  id: string
  name: string
  date: Date
  type: TournamentType
  customTypeName: string | null
  myDeckId: string | null
  myDeckVersion: DeckVersionRef | null
  myLeader: LeaderCard | null
  createdAt: Date
  updatedAt: Date
}

export interface TournamentWithMatches extends Tournament {
  matches: Match[]
  wins: number
  losses: number
  draws: number
  winRate: number
}

export interface Match {
  id: string
  tournamentId: string
  result: MatchResult
  opponentLeader: LeaderCard | null
  memo: string | null
  order: number
  createdAt: Date
  // フリープレイ用：試合ごとのデッキ情報
  myDeckId: string | null
  myDeckVersion: DeckVersionRef | null
  myLeader: LeaderCard | null
}

export interface WinRateStats {
  total: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

export interface LeaderWinRate extends WinRateStats {
  leader: LeaderCard
}

export interface DeckWinRate extends WinRateStats {
  deckId: string
  deckName: string
  leader: LeaderCard | null
}

export interface TournamentTypeWinRate extends WinRateStats {
  type: TournamentType
  customTypeName?: string
}
