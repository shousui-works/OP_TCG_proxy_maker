import type { TournamentWithMatches, LeaderCard, Match } from '../types'

export interface WinRateStat {
  wins: number
  losses: number
  draws: number
  total: number
  winRate: number
}

export interface LeaderStats extends WinRateStat {
  leader: LeaderCard
}

export interface DailyStats extends WinRateStat {
  date: string // YYYY-MM-DD
}

export interface OverallStats extends WinRateStat {
  tournamentCount: number
  winStreak: number
  lossStreak: number
}

/**
 * 勝率を計算
 */
function calculateWinRate(wins: number, total: number): number {
  if (total === 0) return 0
  return (wins / total) * 100
}

/**
 * 全体統計を計算
 */
export function calculateOverallStats(tournaments: TournamentWithMatches[]): OverallStats {
  let wins = 0
  let losses = 0
  let draws = 0

  // 連勝・連敗計算用
  let currentWinStreak = 0
  let currentLossStreak = 0
  let maxWinStreak = 0
  let maxLossStreak = 0

  // 全試合を時系列で取得（日付順→ラウンド順）
  const allMatches: { date: Date; match: Match }[] = []
  for (const tournament of tournaments) {
    for (const match of tournament.matches) {
      allMatches.push({ date: tournament.date, match })
    }
  }

  // 日付とラウンド順でソート
  allMatches.sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime()
    if (dateDiff !== 0) return dateDiff
    return a.match.order - b.match.order
  })

  for (const { match } of allMatches) {
    if (match.result === 'win') {
      wins++
      currentWinStreak++
      currentLossStreak = 0
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak)
    } else if (match.result === 'loss') {
      losses++
      currentLossStreak++
      currentWinStreak = 0
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak)
    } else {
      draws++
      currentWinStreak = 0
      currentLossStreak = 0
    }
  }

  const total = wins + losses + draws

  return {
    wins,
    losses,
    draws,
    total,
    winRate: calculateWinRate(wins, total),
    tournamentCount: tournaments.length,
    winStreak: maxWinStreak,
    lossStreak: maxLossStreak,
  }
}

/**
 * 使用リーダー別の統計を計算
 */
export function calculateMyLeaderStats(tournaments: TournamentWithMatches[]): LeaderStats[] {
  const leaderMap = new Map<string, { leader: LeaderCard; stat: WinRateStat }>()

  for (const tournament of tournaments) {
    // フリープレイ以外: 大会単位で使用リーダー統計を集計
    if (tournament.type !== 'freeplay' && tournament.myLeader) {
      const key = tournament.myLeader.id
      if (!leaderMap.has(key)) {
        leaderMap.set(key, {
          leader: tournament.myLeader,
          stat: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
        })
      }
      const entry = leaderMap.get(key)!
      entry.stat.wins += tournament.wins
      entry.stat.losses += tournament.losses
      entry.stat.draws += tournament.draws
      entry.stat.total += tournament.matches.length
    }

    // フリープレイ: 試合ごとに使用リーダー統計を集計
    if (tournament.type === 'freeplay') {
      for (const match of tournament.matches) {
        if (match.myLeader) {
          const key = match.myLeader.id
          if (!leaderMap.has(key)) {
            leaderMap.set(key, {
              leader: match.myLeader,
              stat: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
            })
          }
          const entry = leaderMap.get(key)!
          entry.stat.total++
          if (match.result === 'win') entry.stat.wins++
          else if (match.result === 'loss') entry.stat.losses++
          else entry.stat.draws++
        }
      }
    }
  }

  // 勝率を計算してソート（試合数が多い順）
  const result: LeaderStats[] = []
  for (const { leader, stat } of leaderMap.values()) {
    result.push({
      leader,
      ...stat,
      winRate: calculateWinRate(stat.wins, stat.total),
    })
  }

  return result.sort((a, b) => b.total - a.total)
}

/**
 * 相手リーダー別の統計を計算（苦手な相手を特定）
 */
export function calculateOpponentStats(tournaments: TournamentWithMatches[]): LeaderStats[] {
  const opponentMap = new Map<string, { leader: LeaderCard; stat: WinRateStat }>()

  for (const tournament of tournaments) {
    for (const match of tournament.matches) {
      if (match.opponentLeader) {
        const key = match.opponentLeader.id
        if (!opponentMap.has(key)) {
          opponentMap.set(key, {
            leader: match.opponentLeader,
            stat: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
          })
        }
        const entry = opponentMap.get(key)!
        entry.stat.total++
        if (match.result === 'win') entry.stat.wins++
        else if (match.result === 'loss') entry.stat.losses++
        else entry.stat.draws++
      }
    }
  }

  // 勝率を計算
  const result: LeaderStats[] = []
  for (const { leader, stat } of opponentMap.values()) {
    result.push({
      leader,
      ...stat,
      winRate: calculateWinRate(stat.wins, stat.total),
    })
  }

  return result
}

/**
 * 苦手な相手（勝率が低い順、3試合以上）
 */
export function calculateWeaknesses(
  tournaments: TournamentWithMatches[],
  minMatches: number = 3
): LeaderStats[] {
  const opponentStats = calculateOpponentStats(tournaments)
  return opponentStats
    .filter((s) => s.total >= minMatches)
    .sort((a, b) => a.winRate - b.winRate)
}

/**
 * 得意な相手（勝率が高い順、3試合以上）
 */
export function calculateStrengths(
  tournaments: TournamentWithMatches[],
  minMatches: number = 3
): LeaderStats[] {
  const opponentStats = calculateOpponentStats(tournaments)
  return opponentStats
    .filter((s) => s.total >= minMatches)
    .sort((a, b) => b.winRate - a.winRate)
}

/**
 * 日別統計を計算
 */
export function calculateDailyStats(tournaments: TournamentWithMatches[]): DailyStats[] {
  const dailyMap = new Map<string, WinRateStat>()

  for (const tournament of tournaments) {
    const dateKey = formatDateKey(tournament.date)

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 })
    }

    const stat = dailyMap.get(dateKey)!
    for (const match of tournament.matches) {
      stat.total++
      if (match.result === 'win') stat.wins++
      else if (match.result === 'loss') stat.losses++
      else stat.draws++
    }
  }

  // 日付順にソート（新しい順）
  const result: DailyStats[] = []
  for (const [date, stat] of dailyMap.entries()) {
    result.push({
      date,
      ...stat,
      winRate: calculateWinRate(stat.wins, stat.total),
    })
  }

  return result.sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 日付を表示用にフォーマット（M/D）
 */
export function formatDisplayDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${parseInt(month)}/${parseInt(day)}`
}

/**
 * 特定リーダー使用時の相手リーダー別相性を計算
 */
export interface MatchupStats extends WinRateStat {
  opponentLeader: LeaderCard
}

export function calculateMatchupsForLeader(
  tournaments: TournamentWithMatches[],
  myLeaderId: string
): MatchupStats[] {
  const matchupMap = new Map<string, { opponent: LeaderCard; stat: WinRateStat }>()

  for (const tournament of tournaments) {
    // 大会使用リーダーが一致する場合（フリープレイ以外）
    if (tournament.type !== 'freeplay' && tournament.myLeader?.id === myLeaderId) {
      for (const match of tournament.matches) {
        if (match.opponentLeader) {
          const key = match.opponentLeader.id
          if (!matchupMap.has(key)) {
            matchupMap.set(key, {
              opponent: match.opponentLeader,
              stat: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
            })
          }
          const entry = matchupMap.get(key)!
          entry.stat.total++
          if (match.result === 'win') entry.stat.wins++
          else if (match.result === 'loss') entry.stat.losses++
          else entry.stat.draws++
        }
      }
    }

    // フリープレイ: 試合ごとに使用リーダーをチェック
    if (tournament.type === 'freeplay') {
      for (const match of tournament.matches) {
        if (match.myLeader?.id === myLeaderId && match.opponentLeader) {
          const key = match.opponentLeader.id
          if (!matchupMap.has(key)) {
            matchupMap.set(key, {
              opponent: match.opponentLeader,
              stat: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
            })
          }
          const entry = matchupMap.get(key)!
          entry.stat.total++
          if (match.result === 'win') entry.stat.wins++
          else if (match.result === 'loss') entry.stat.losses++
          else entry.stat.draws++
        }
      }
    }
  }

  // 結果を作成（試合数順でソート）
  const result: MatchupStats[] = []
  for (const { opponent, stat } of matchupMap.values()) {
    result.push({
      opponentLeader: opponent,
      ...stat,
      winRate: calculateWinRate(stat.wins, stat.total),
    })
  }

  return result.sort((a, b) => b.total - a.total)
}

/**
 * 日別統計を古い順に取得（グラフ用）
 */
export function calculateDailyStatsChronological(
  tournaments: TournamentWithMatches[]
): DailyStats[] {
  const stats = calculateDailyStats(tournaments)
  // 古い順に並び替え
  return stats.slice().sort((a, b) => a.date.localeCompare(b.date))
}

export type ChartPeriod = 'daily' | 'weekly' | 'monthly'

export interface PeriodStats extends WinRateStat {
  label: string // 表示用ラベル
  periodKey: string // ソート用キー
}

/**
 * 週の開始日（月曜日）を取得
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // 月曜日を週の開始とする
  d.setDate(diff)
  return d
}

/**
 * 週キーをYYYY-Www形式で取得
 */
function getWeekKey(date: Date): string {
  const weekStart = getWeekStart(date)
  const year = weekStart.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const days = Math.floor((weekStart.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7)
  return `${year}-W${String(weekNum).padStart(2, '0')}`
}

/**
 * 月キーをYYYY-MM形式で取得
 */
function getMonthKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * 週別統計を計算
 */
export function calculateWeeklyStats(tournaments: TournamentWithMatches[]): PeriodStats[] {
  const weeklyMap = new Map<string, WinRateStat & { weekStart: Date }>()

  for (const tournament of tournaments) {
    const weekKey = getWeekKey(tournament.date)
    const weekStart = getWeekStart(tournament.date)

    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, {
        wins: 0,
        losses: 0,
        draws: 0,
        total: 0,
        winRate: 0,
        weekStart,
      })
    }

    const stat = weeklyMap.get(weekKey)!
    for (const match of tournament.matches) {
      stat.total++
      if (match.result === 'win') stat.wins++
      else if (match.result === 'loss') stat.losses++
      else stat.draws++
    }
  }

  const result: PeriodStats[] = []
  for (const [periodKey, stat] of weeklyMap.entries()) {
    const m = stat.weekStart.getMonth() + 1
    const d = stat.weekStart.getDate()
    result.push({
      label: `${m}/${d}週`,
      periodKey,
      wins: stat.wins,
      losses: stat.losses,
      draws: stat.draws,
      total: stat.total,
      winRate: calculateWinRate(stat.wins, stat.total),
    })
  }

  return result.sort((a, b) => a.periodKey.localeCompare(b.periodKey))
}

/**
 * 月別統計を計算
 */
export function calculateMonthlyStats(tournaments: TournamentWithMatches[]): PeriodStats[] {
  const monthlyMap = new Map<string, WinRateStat>()

  for (const tournament of tournaments) {
    const monthKey = getMonthKey(tournament.date)

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 })
    }

    const stat = monthlyMap.get(monthKey)!
    for (const match of tournament.matches) {
      stat.total++
      if (match.result === 'win') stat.wins++
      else if (match.result === 'loss') stat.losses++
      else stat.draws++
    }
  }

  const result: PeriodStats[] = []
  for (const [periodKey, stat] of monthlyMap.entries()) {
    const [year, month] = periodKey.split('-')
    result.push({
      label: `${year}/${parseInt(month)}`,
      periodKey,
      wins: stat.wins,
      losses: stat.losses,
      draws: stat.draws,
      total: stat.total,
      winRate: calculateWinRate(stat.wins, stat.total),
    })
  }

  return result.sort((a, b) => a.periodKey.localeCompare(b.periodKey))
}

/**
 * 期間別統計を計算（統合関数）
 */
export function calculatePeriodStats(
  tournaments: TournamentWithMatches[],
  period: ChartPeriod
): PeriodStats[] {
  switch (period) {
    case 'weekly':
      return calculateWeeklyStats(tournaments)
    case 'monthly':
      return calculateMonthlyStats(tournaments)
    case 'daily':
    default: {
      const dailyStats = calculateDailyStatsChronological(tournaments)
      return dailyStats.map((stat) => ({
        label: formatDisplayDate(stat.date),
        periodKey: stat.date,
        wins: stat.wins,
        losses: stat.losses,
        draws: stat.draws,
        total: stat.total,
        winRate: stat.winRate,
      }))
    }
  }
}
