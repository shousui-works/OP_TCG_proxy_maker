import { useMemo } from 'react'
import type { TournamentWithMatches, TournamentType, LeaderCard } from '../../types'
import { TOURNAMENT_TYPE_LABELS } from '../../types'
import { resolveCardImage } from '../../utils/cardImage'
import './StatsOverview.css'

interface StatsOverviewProps {
  tournaments: TournamentWithMatches[]
  isExpanded: boolean
  onToggle: () => void
}

interface WinRateStat {
  wins: number
  losses: number
  draws: number
  total: number
  winRate: number
}

export function StatsOverview({ tournaments, isExpanded, onToggle }: StatsOverviewProps) {
  const stats = useMemo(() => {
    // Overall stats
    const overall: WinRateStat = {
      wins: 0,
      losses: 0,
      draws: 0,
      total: 0,
      winRate: 0,
    }

    // By tournament type
    const byType: Record<TournamentType, WinRateStat> = {
      flagship: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
      standard_battle: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
      championship: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
      freeplay: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
      other: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
    }

    // By my leader
    const byMyLeader: Map<string, { leader: LeaderCard; stat: WinRateStat }> = new Map()

    // By opponent leader
    const byOpponentLeader: Map<string, { leader: LeaderCard; stat: WinRateStat }> = new Map()

    for (const tournament of tournaments) {
      // Aggregate type stats
      const typeStat = byType[tournament.type]
      typeStat.wins += tournament.wins
      typeStat.losses += tournament.losses
      typeStat.draws += tournament.draws
      typeStat.total += tournament.matches.length

      // フリープレイ以外: 大会単位で使用リーダー統計を集計
      if (tournament.type !== 'freeplay' && tournament.myLeader) {
        const key = tournament.myLeader.id
        if (!byMyLeader.has(key)) {
          byMyLeader.set(key, {
            leader: tournament.myLeader,
            stat: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
          })
        }
        const leaderStat = byMyLeader.get(key)!.stat
        leaderStat.wins += tournament.wins
        leaderStat.losses += tournament.losses
        leaderStat.draws += tournament.draws
        leaderStat.total += tournament.matches.length
      }

      // Aggregate opponent leader stats and freeplay my leader stats
      for (const match of tournament.matches) {
        overall.total++
        if (match.result === 'win') overall.wins++
        else if (match.result === 'loss') overall.losses++
        else overall.draws++

        // フリープレイ: 試合ごとに使用リーダー統計を集計
        if (tournament.type === 'freeplay' && match.myLeader) {
          const key = match.myLeader.id
          if (!byMyLeader.has(key)) {
            byMyLeader.set(key, {
              leader: match.myLeader,
              stat: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
            })
          }
          const leaderStat = byMyLeader.get(key)!.stat
          leaderStat.total++
          if (match.result === 'win') leaderStat.wins++
          else if (match.result === 'loss') leaderStat.losses++
          else leaderStat.draws++
        }

        if (match.opponentLeader) {
          const key = match.opponentLeader.id
          if (!byOpponentLeader.has(key)) {
            byOpponentLeader.set(key, {
              leader: match.opponentLeader,
              stat: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 },
            })
          }
          const oppStat = byOpponentLeader.get(key)!.stat
          oppStat.total++
          if (match.result === 'win') oppStat.wins++
          else if (match.result === 'loss') oppStat.losses++
          else oppStat.draws++
        }
      }
    }

    // Calculate win rates
    if (overall.total > 0) {
      overall.winRate = (overall.wins / overall.total) * 100
    }

    for (const typeStat of Object.values(byType)) {
      if (typeStat.total > 0) {
        typeStat.winRate = (typeStat.wins / typeStat.total) * 100
      }
    }

    for (const { stat } of byMyLeader.values()) {
      if (stat.total > 0) {
        stat.winRate = (stat.wins / stat.total) * 100
      }
    }

    for (const { stat } of byOpponentLeader.values()) {
      if (stat.total > 0) {
        stat.winRate = (stat.wins / stat.total) * 100
      }
    }

    // Sort by leader stats by total games (descending)
    const sortedByMyLeader = Array.from(byMyLeader.values()).sort(
      (a, b) => b.stat.total - a.stat.total
    )
    const sortedByOpponentLeader = Array.from(byOpponentLeader.values()).sort(
      (a, b) => b.stat.total - a.stat.total
    )

    return {
      overall,
      byType,
      byMyLeader: sortedByMyLeader,
      byOpponentLeader: sortedByOpponentLeader,
    }
  }, [tournaments])

  const formatRecord = (stat: WinRateStat) => {
    if (stat.draws > 0) {
      return `${stat.wins}勝${stat.losses}敗${stat.draws}分`
    }
    return `${stat.wins}勝${stat.losses}敗`
  }

  return (
    <div className="stats-overview">
      <button
        className="stats-toggle"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls="stats-details"
      >
        <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
        <span className="stats-summary">
          全体: {formatRecord(stats.overall)} ({stats.overall.winRate.toFixed(1)}%)
        </span>
      </button>

      {isExpanded && (
        <div id="stats-details" className="stats-details">
          {/* By Tournament Type */}
          <div className="stats-section">
            <h4>大会タイプ別</h4>
            <div className="stats-list">
              {(Object.entries(stats.byType) as [TournamentType, WinRateStat][])
                .filter(([, stat]) => stat.total > 0)
                .map(([type, stat]) => (
                  <div key={type} className="stats-row">
                    <span className="stats-label">{TOURNAMENT_TYPE_LABELS[type]}</span>
                    <span className="stats-value">
                      {formatRecord(stat)} ({stat.winRate.toFixed(1)}%)
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* By My Leader */}
          {stats.byMyLeader.length > 0 && (
            <div className="stats-section">
              <h4>使用リーダー別</h4>
              <div className="stats-list">
                {stats.byMyLeader.slice(0, 5).map(({ leader, stat }) => (
                  <div key={leader.id} className="stats-row with-image">
                    <img
                      src={resolveCardImage(leader.image, leader.id)}
                      alt={leader.name}
                      className="stats-leader-img"
                    />
                    <span className="stats-label">{leader.name}</span>
                    <span className="stats-value">
                      {formatRecord(stat)} ({stat.winRate.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Opponent Leader */}
          {stats.byOpponentLeader.length > 0 && (
            <div className="stats-section">
              <h4>相手リーダー別</h4>
              <div className="stats-list">
                {stats.byOpponentLeader.slice(0, 5).map(({ leader, stat }) => (
                  <div key={leader.id} className="stats-row with-image">
                    <img
                      src={resolveCardImage(leader.image, leader.id)}
                      alt={leader.name}
                      className="stats-leader-img"
                    />
                    <span className="stats-label">{leader.name}</span>
                    <span className="stats-value">
                      {formatRecord(stat)} ({stat.winRate.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
