import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { useTournaments } from '../hooks/useTournaments'
import { resolveCardImage } from '../utils/cardImage'
import {
  calculateOverallStats,
  calculateMyLeaderStats,
  calculateWeaknesses,
  calculateStrengths,
  calculateMatchupsForLeader,
  calculateDailyStatsChronological,
  formatDisplayDate,
} from '../utils/analyticsCalculator'
import type { TournamentWithMatches, LeaderCard } from '../types'
import LoginButton from '../components/LoginButton'
import './AnalyticsPage.css'

export function AnalyticsPage() {
  const navigate = useNavigate()
  const { user, isFirebaseEnabled } = useAuth()
  const { fetchTournaments } = useTournaments()

  const [tournaments, setTournaments] = useState<TournamentWithMatches[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLeader, setSelectedLeader] = useState<LeaderCard | null>(null)
    const [dataPeriod, setDataPeriod] = useState<'all' | 'month' | 'week' | 'day'>('month')

  const loadTournaments = useCallback(async () => {
    if (!user || !isFirebaseEnabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const data = await fetchTournaments()
      setTournaments(data)
    } catch (error) {
      console.error('Failed to load tournaments:', error)
    } finally {
      setLoading(false)
    }
  }, [user, isFirebaseEnabled, fetchTournaments])

  useEffect(() => {
    loadTournaments()
  }, [loadTournaments])

  // 期間でフィルタリングされた大会データ
  const filteredTournaments = useMemo(() => {
    if (dataPeriod === 'all') return tournaments

    const now = new Date()
    let cutoffDate: Date

    switch (dataPeriod) {
      case 'day':
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      default:
        return tournaments
    }

    return tournaments.filter((t) => t.date >= cutoffDate)
  }, [tournaments, dataPeriod])

  // 統計計算（フィルタリング済みデータを使用）
  const overallStats = useMemo(() => calculateOverallStats(filteredTournaments), [filteredTournaments])
  const myLeaderStats = useMemo(() => calculateMyLeaderStats(filteredTournaments), [filteredTournaments])
  const weaknesses = useMemo(() => calculateWeaknesses(filteredTournaments, 2), [filteredTournaments])
  const strengths = useMemo(() => calculateStrengths(filteredTournaments, 2), [filteredTournaments])
  const dailyStats = useMemo(
    () => calculateDailyStatsChronological(filteredTournaments),
    [filteredTournaments]
  )

  // 選択したリーダーの相性分析（フィルタリング済みデータを使用）
  const selectedLeaderMatchups = useMemo(() => {
    if (!selectedLeader) return []
    return calculateMatchupsForLeader(filteredTournaments, selectedLeader.id)
  }, [filteredTournaments, selectedLeader])

  // 選択したリーダーの統計
  const selectedLeaderStats = useMemo(() => {
    if (!selectedLeader) return null
    return myLeaderStats.find((s) => s.leader.id === selectedLeader.id)
  }, [myLeaderStats, selectedLeader])

  // グラフ用データ（最新30日分）
  const chartData = useMemo(() => {
    return dailyStats.slice(-30).map((stat) => ({
      date: formatDisplayDate(stat.date),
      winRate: Math.round(stat.winRate),
      total: stat.total,
    }))
  }, [dailyStats])

  // 散布図用データ（リーダー別：横軸=利用率、縦軸=勝率）
  const scatterData = useMemo(() => {
    if (overallStats.total === 0) return []
    return myLeaderStats.map((stat) => ({
      name: stat.leader.name.split('/')[0],
      usageRate: (stat.total / overallStats.total) * 100,
      winRate: stat.winRate,
      total: stat.total,
      leaderId: stat.leader.id,
      image: resolveCardImage(stat.leader.image, stat.leader.id),
    }))
  }, [myLeaderStats, overallStats.total])

  // カスタム散布図ポイント（カードアイコン）
  const renderCustomShape = (props: {
    cx?: number
    cy?: number
    payload?: { image: string; name: string }
  }) => {
    const { cx, cy, payload } = props
    if (cx === undefined || cy === undefined || !payload) return null

    const size = 28
    return (
      <image
        x={cx - size / 2}
        y={cy - size / 2}
        width={size}
        height={size}
        href={payload.image}
        style={{ borderRadius: '4px' }}
      />
    )
  }

  const formatRecord = (wins: number, losses: number, draws: number) => {
    if (draws > 0) {
      return `${wins}勝${losses}敗${draws}分`
    }
    return `${wins}勝${losses}敗`
  }

  const pageHead = (
    <Helmet>
      <title>アナリティクス | OP-TCG base</title>
      <meta
        name="description"
        content="ONE PIECEカードゲームの戦績を詳細分析。リーダー別成績、苦手な相手、日別推移を確認。"
      />
      <link rel="canonical" href="https://op-tcg-base.ludora-base.com/analytics" />
    </Helmet>
  )

  // Firebase無効時
  if (!isFirebaseEnabled) {
    return (
      <div className="analytics-page">
        {pageHead}
        <header className="analytics-header">
          <button className="back-button" onClick={() => navigate('/')}>
            ← 戻る
          </button>
          <h1>アナリティクス</h1>
        </header>
        <div className="login-prompt">
          <p>アナリティクス機能は現在利用できません。</p>
        </div>
      </div>
    )
  }

  // 未ログイン時
  if (!user) {
    return (
      <div className="analytics-page">
        {pageHead}
        <header className="analytics-header">
          <button className="back-button" onClick={() => navigate('/')}>
            ← 戻る
          </button>
          <h1>アナリティクス</h1>
        </header>
        <div className="login-prompt">
          <p>アナリティクス機能を使用するにはログインが必要です。</p>
          <LoginButton />
        </div>
      </div>
    )
  }

  return (
    <div className="analytics-page">
      {pageHead}
      <header className="analytics-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← 戻る
        </button>
        <h1>アナリティクス</h1>
      </header>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : tournaments.length === 0 ? (
        <div className="empty-state">
          <p>分析するデータがありません</p>
          <button onClick={() => navigate('/tournaments')}>大会を追加する</button>
        </div>
      ) : (
        <div className="analytics-content">
          {/* 期間フィルター */}
          <div className="data-period-filter">
            <span className="filter-label">期間:</span>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${dataPeriod === 'all' ? 'active' : ''}`}
                onClick={() => setDataPeriod('all')}
              >
                全期間
              </button>
              <button
                className={`filter-btn ${dataPeriod === 'month' ? 'active' : ''}`}
                onClick={() => setDataPeriod('month')}
              >
                今月
              </button>
              <button
                className={`filter-btn ${dataPeriod === 'week' ? 'active' : ''}`}
                onClick={() => setDataPeriod('week')}
              >
                直近7日
              </button>
              <button
                className={`filter-btn ${dataPeriod === 'day' ? 'active' : ''}`}
                onClick={() => setDataPeriod('day')}
              >
                今日
              </button>
            </div>
          </div>

          {/* ダッシュボード上段: 全体サマリーと日別勝率グラフ */}
          <div className="dashboard-top">
            {/* 全体サマリー */}
            <section className="analytics-section summary-section">
              <h2>全体サマリー</h2>
              <div className="summary-grid">
                <div className="summary-card">
                  <div className="summary-label">総試合数</div>
                  <div className="summary-value">{overallStats.total}</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">勝率</div>
                  <div className="summary-value highlight">{overallStats.winRate.toFixed(1)}%</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">戦績</div>
                  <div className="summary-value">
                    {formatRecord(overallStats.wins, overallStats.losses, overallStats.draws)}
                  </div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">大会数</div>
                  <div className="summary-value">{overallStats.tournamentCount}</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">最大連勝</div>
                  <div className="summary-value win">{overallStats.winStreak}</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">最大連敗</div>
                  <div className="summary-value loss">{overallStats.lossStreak}</div>
                </div>
              </div>
            </section>

            {/* 勝率推移グラフ */}
            {chartData.length > 1 && (
              <section className="analytics-section chart-section">
                <h2>勝率推移</h2>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#aaa', fontSize: 11 }}
                        tickLine={{ stroke: '#2a2a4a' }}
                        axisLine={{ stroke: '#2a2a4a' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: '#aaa', fontSize: 11 }}
                        tickLine={{ stroke: '#2a2a4a' }}
                        axisLine={{ stroke: '#2a2a4a' }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#16213e',
                          border: '1px solid #2a2a4a',
                          borderRadius: '4px',
                        }}
                        labelStyle={{ color: '#e0e0e0' }}
                        formatter={(value, name) => {
                          if (name === 'winRate') return [`${value}%`, '勝率']
                          return [String(value), String(name)]
                        }}
                      />
                      <ReferenceLine y={50} stroke="#666" strokeDasharray="5 5" />
                      <Line
                        type="monotone"
                        dataKey="winRate"
                        stroke="#4fc3f7"
                        strokeWidth={2}
                        dot={{ fill: '#4fc3f7', r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}
          </div>

          {/* リーダー別散布図 */}
          {scatterData.length > 1 && (
            <section className="analytics-section scatter-section">
              <h2>リーダー分布</h2>
              <p className="section-desc">横軸: 利用率、縦軸: 勝率</p>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={250}>
                  <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                    <XAxis
                      type="number"
                      dataKey="usageRate"
                      name="利用率"
                      domain={[0, 'auto']}
                      tick={{ fill: '#aaa', fontSize: 11 }}
                      tickLine={{ stroke: '#2a2a4a' }}
                      axisLine={{ stroke: '#2a2a4a' }}
                      tickFormatter={(v) => `${v.toFixed(0)}%`}
                      label={{ value: '利用率', position: 'bottom', fill: '#aaa', fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="winRate"
                      name="勝率"
                      domain={[0, 100]}
                      tick={{ fill: '#aaa', fontSize: 11 }}
                      tickLine={{ stroke: '#2a2a4a' }}
                      axisLine={{ stroke: '#2a2a4a' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{
                        backgroundColor: '#16213e',
                        border: '1px solid #2a2a4a',
                        borderRadius: '4px',
                      }}
                      formatter={(value, name) => {
                        if (name === '利用率' || name === '勝率') return [`${Number(value).toFixed(1)}%`, name]
                        return [value, name]
                      }}
                      labelFormatter={(_, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.name
                        }
                        return ''
                      }}
                    />
                    <ReferenceLine y={50} stroke="#666" strokeDasharray="5 5" />
                    <Scatter
                      name="リーダー"
                      data={scatterData}
                      shape={renderCustomShape}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* リーダー別相性分析 */}
          <section className="analytics-section matchup-section">
            <h2>リーダー別相性分析</h2>
            <p className="section-desc">リーダーを選択して、相手との相性を確認</p>

            {/* リーダー選択タブ */}
            <div className="leader-tabs">
              {myLeaderStats.map((stat) => {
                const usageRate = overallStats.total > 0 ? (stat.total / overallStats.total) * 100 : 0
                return (
                  <button
                    key={stat.leader.id}
                    className={`leader-tab ${selectedLeader?.id === stat.leader.id ? 'active' : ''}`}
                    onClick={() => setSelectedLeader(stat.leader)}
                  >
                    <img
                      src={resolveCardImage(stat.leader.image, stat.leader.id)}
                      alt={stat.leader.name}
                      className="leader-tab-img"
                    />
                    <span className="leader-tab-name">{stat.leader.name.split('/')[0]}</span>
                    <div className="leader-tab-stats">
                      <span className="leader-tab-rate">{stat.winRate.toFixed(0)}%</span>
                      <span className="leader-tab-usage">{usageRate.toFixed(0)}%使用</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 相性表示 */}
            {selectedLeader && selectedLeaderStats && (
              <div className="matchup-detail">
                <div className="matchup-header">
                  <img
                    src={resolveCardImage(selectedLeader.image, selectedLeader.id)}
                    alt={selectedLeader.name}
                    className="matchup-leader-img"
                  />
                  <div className="matchup-leader-info">
                    <div className="matchup-leader-name">{selectedLeader.name}</div>
                    <div className="matchup-leader-stats">
                      {formatRecord(
                        selectedLeaderStats.wins,
                        selectedLeaderStats.losses,
                        selectedLeaderStats.draws
                      )}{' '}
                      / 勝率 {selectedLeaderStats.winRate.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {selectedLeaderMatchups.length > 0 ? (
                  <div className="matchup-grid">
                    <div className="matchup-column">
                      <h3 className="matchup-column-title good">得意な相手</h3>
                      <div className="matchup-list">
                        {selectedLeaderMatchups
                          .filter((m) => m.winRate >= 50)
                          .sort((a, b) => b.winRate - a.winRate)
                          .slice(0, 5)
                          .map((matchup) => (
                            <div key={matchup.opponentLeader.id} className="matchup-item good">
                              <img
                                src={resolveCardImage(
                                  matchup.opponentLeader.image,
                                  matchup.opponentLeader.id
                                )}
                                alt={matchup.opponentLeader.name}
                                className="matchup-opponent-img"
                              />
                              <div className="matchup-opponent-info">
                                <div className="matchup-opponent-name">
                                  {matchup.opponentLeader.name}
                                </div>
                                <div className="matchup-opponent-record">
                                  {formatRecord(matchup.wins, matchup.losses, matchup.draws)}
                                </div>
                              </div>
                              <div className="matchup-winrate good">
                                {matchup.winRate.toFixed(0)}%
                              </div>
                            </div>
                          ))}
                        {selectedLeaderMatchups.filter((m) => m.winRate >= 50).length === 0 && (
                          <p className="no-matchup">データなし</p>
                        )}
                      </div>
                    </div>
                    <div className="matchup-column">
                      <h3 className="matchup-column-title bad">苦手な相手</h3>
                      <div className="matchup-list">
                        {selectedLeaderMatchups
                          .filter((m) => m.winRate < 50)
                          .sort((a, b) => a.winRate - b.winRate)
                          .slice(0, 5)
                          .map((matchup) => (
                            <div key={matchup.opponentLeader.id} className="matchup-item bad">
                              <img
                                src={resolveCardImage(
                                  matchup.opponentLeader.image,
                                  matchup.opponentLeader.id
                                )}
                                alt={matchup.opponentLeader.name}
                                className="matchup-opponent-img"
                              />
                              <div className="matchup-opponent-info">
                                <div className="matchup-opponent-name">
                                  {matchup.opponentLeader.name}
                                </div>
                                <div className="matchup-opponent-record">
                                  {formatRecord(matchup.wins, matchup.losses, matchup.draws)}
                                </div>
                              </div>
                              <div className="matchup-winrate bad">
                                {matchup.winRate.toFixed(0)}%
                              </div>
                            </div>
                          ))}
                        {selectedLeaderMatchups.filter((m) => m.winRate < 50).length === 0 && (
                          <p className="no-matchup">データなし</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="no-matchup-data">相手リーダーのデータがありません</p>
                )}
              </div>
            )}

            {!selectedLeader && myLeaderStats.length > 0 && (
              <p className="select-leader-hint">上のリーダーを選択してください</p>
            )}
          </section>

          {/* 下段: 全体の得意・苦手 */}
          <div className="dashboard-bottom">
            {/* 得意な相手 */}
            {strengths.length > 0 && (
              <section className="analytics-section">
                <h2>得意な相手</h2>
                <p className="section-desc">勝率が高い相手リーダー（2戦以上）</p>
                <div className="leader-stats-list">
                  {strengths.slice(0, 5).map((stat) => (
                    <div key={stat.leader.id} className="leader-stat-item strength">
                      <img
                        src={resolveCardImage(stat.leader.image, stat.leader.id)}
                        alt={stat.leader.name}
                        className="leader-img"
                      />
                      <div className="leader-info">
                        <div className="leader-name">{stat.leader.name}</div>
                        <div className="leader-record">
                          {formatRecord(stat.wins, stat.losses, stat.draws)}
                        </div>
                      </div>
                      <div className="leader-winrate high">{stat.winRate.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 苦手な相手 */}
            {weaknesses.length > 0 && (
              <section className="analytics-section">
                <h2>苦手な相手</h2>
                <p className="section-desc">勝率が低い相手リーダー（2戦以上）</p>
                <div className="leader-stats-list">
                  {weaknesses.slice(0, 5).map((stat) => (
                    <div key={stat.leader.id} className="leader-stat-item weakness">
                      <img
                        src={resolveCardImage(stat.leader.image, stat.leader.id)}
                        alt={stat.leader.name}
                        className="leader-img"
                      />
                      <div className="leader-info">
                        <div className="leader-name">{stat.leader.name}</div>
                        <div className="leader-record">
                          {formatRecord(stat.wins, stat.losses, stat.draws)}
                        </div>
                      </div>
                      <div className="leader-winrate low">{stat.winRate.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
