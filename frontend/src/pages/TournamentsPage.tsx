import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import SEOHead, { createBreadcrumbStructuredData } from '../components/SEOHead'
import PageNav from '../components/PageNav'
import { useTournaments } from '../hooks/useTournaments'
import { useMatches } from '../hooks/useMatches'
import { useFirestoreDeck } from '../hooks/useFirestoreDeck'
import { TournamentCard } from '../components/tournaments/TournamentCard'
import { TournamentModal } from '../components/tournaments/TournamentModal'
import { MatchModal } from '../components/tournaments/MatchModal'
import { StatsOverview } from '../components/tournaments/StatsOverview'
import LoginButton from '../components/LoginButton'
import type {
  TournamentWithMatches,
  Match,
  TournamentType,
  LeaderCard,
  MatchResult,
  DeckVersionRef,
} from '../types'
import './TournamentsPage.css'

export function TournamentsPage() {
  const { user, isFirebaseEnabled } = useAuth()
  const { fetchTournaments, createTournament, updateTournament, deleteTournament } =
    useTournaments()
  const { createMatch, updateMatch, deleteMatch } = useMatches()
  const { getVersion, getDeck } = useFirestoreDeck()

  const [tournaments, setTournaments] = useState<TournamentWithMatches[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set())

  // Modal states
  const [showTournamentModal, setShowTournamentModal] = useState(false)
  const [editingTournament, setEditingTournament] = useState<TournamentWithMatches | null>(
    null
  )
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [editingMatch, setEditingMatch] = useState<{
    tournamentId: string
    match: Match | null
  } | null>(null)

  const [showStats, setShowStats] = useState(true)

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

  const handleToggleExpand = (tournamentId: string) => {
    setExpandedTournaments((prev) => {
      const next = new Set(prev)
      if (next.has(tournamentId)) {
        next.delete(tournamentId)
      } else {
        next.add(tournamentId)
      }
      return next
    })
  }

  const handleAddTournament = () => {
    setEditingTournament(null)
    setShowTournamentModal(true)
  }

  const handleEditTournament = (tournament: TournamentWithMatches) => {
    setEditingTournament(tournament)
    setShowTournamentModal(true)
  }

  const handleSaveTournament = async (data: {
    name: string
    date: Date
    type: TournamentType
    customTypeName?: string
    myDeckId?: string | null
    myDeckVersion?: DeckVersionRef | null
    myLeader?: LeaderCard | null
  }) => {
    try {
      if (editingTournament) {
        await updateTournament(editingTournament.id, data)
      } else {
        await createTournament(data)
      }
      setShowTournamentModal(false)
      setEditingTournament(null)
      await loadTournaments()
    } catch (error) {
      console.error('Failed to save tournament:', error)
    }
  }

  const handleDeleteTournament = async (tournamentId: string) => {
    if (!confirm('この大会を削除しますか？試合記録も全て削除されます。')) {
      return
    }
    try {
      await deleteTournament(tournamentId)
      await loadTournaments()
    } catch (error) {
      console.error('Failed to delete tournament:', error)
    }
  }

  const handleAddMatch = (tournamentId: string) => {
    setEditingMatch({ tournamentId, match: null })
    setShowMatchModal(true)
  }

  const handleEditMatch = (tournamentId: string, match: Match) => {
    setEditingMatch({ tournamentId, match })
    setShowMatchModal(true)
  }

  const handleSaveMatch = async (data: {
    result: MatchResult
    opponentLeader?: LeaderCard | null
    memo?: string
    myDeckId?: string | null
    myDeckVersion?: DeckVersionRef | null
    myLeader?: LeaderCard | null
  }) => {
    if (!editingMatch) return

    try {
      if (editingMatch.match) {
        await updateMatch(editingMatch.tournamentId, editingMatch.match.id, data)
      } else {
        await createMatch(editingMatch.tournamentId, data)
      }
      setShowMatchModal(false)
      setEditingMatch(null)
      await loadTournaments()
    } catch (error) {
      console.error('Failed to save match:', error)
    }
  }

  const handleDeleteMatch = async (tournamentId: string, matchId: string) => {
    if (!confirm('この試合を削除しますか？')) {
      return
    }
    try {
      await deleteMatch(tournamentId, matchId)
      await loadTournaments()
    } catch (error) {
      console.error('Failed to delete match:', error)
    }
  }

  // フリープレイかどうかを判定するヘルパー
  const isFreeplayTournament = (tournamentId: string): boolean => {
    const tournament = tournaments.find((t) => t.id === tournamentId)
    return tournament?.type === 'freeplay'
  }

  const tournamentsStructuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      createBreadcrumbStructuredData([
        { name: 'ホーム', url: '/' },
        { name: '戦績管理', url: '/tournaments' },
      ]),
      {
        '@type': 'SoftwareApplication',
        name: 'ワンピースカード 戦績管理ツール',
        description: 'ONE PIECEカードゲームの大会・試合結果を記録し、勝率を自動集計',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
      },
    ],
  }

  const pageHead = (
    <SEOHead
      title="ワンピースカード 戦績管理・勝率記録"
      description="ワンピースカード(OPTCG)の大会・フリー対戦の戦績を記録。リーダー別勝率、相手デッキ別の成績を自動集計。無料で使える戦績管理ツール。"
      canonicalPath="/tournaments"
      keywords="ワンピースカード 戦績, OPTCG 勝率, ワンピースカード 大会記録, デッキ 勝率管理, ワンピースカードゲーム 成績"
      structuredData={tournamentsStructuredData}
    />
  )

  // Show message if Firebase is disabled
  if (!isFirebaseEnabled) {
    return (
      <div className="tournaments-page">
        {pageHead}
        <PageNav />
        <header className="tournaments-header">
          <h1>戦績管理</h1>
        </header>
        <div className="login-prompt">
          <p>戦績管理機能は現在利用できません。</p>
        </div>
      </div>
    )
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="tournaments-page">
        {pageHead}
        <PageNav />
        <header className="tournaments-header">
          <h1>戦績管理</h1>
        </header>
        <div className="login-prompt">
          <p>戦績管理機能を使用するにはログインが必要です。</p>
          <LoginButton />
        </div>
      </div>
    )
  }

  return (
    <div className="tournaments-page">
      {pageHead}
      <PageNav />
      <header className="tournaments-header">
        <h1>戦績管理</h1>
        <div className="header-actions">
          <button className="add-tournament-button" onClick={handleAddTournament}>
            + 追加
          </button>
        </div>
      </header>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : (
        <>
          {tournaments.length > 0 && (
            <StatsOverview
              tournaments={tournaments}
              isExpanded={showStats}
              onToggle={() => setShowStats(!showStats)}
            />
          )}

          <div className="tournaments-list">
            {tournaments.length === 0 ? (
              <div className="empty-state">
                <p>大会がありません</p>
                <button onClick={handleAddTournament}>最初の大会を追加</button>
              </div>
            ) : (
              tournaments.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  isExpanded={expandedTournaments.has(tournament.id)}
                  onToggleExpand={() => handleToggleExpand(tournament.id)}
                  onEdit={() => handleEditTournament(tournament)}
                  onDelete={() => handleDeleteTournament(tournament.id)}
                  onAddMatch={() => handleAddMatch(tournament.id)}
                  onEditMatch={(match) => handleEditMatch(tournament.id, match)}
                  onDeleteMatch={(matchId) => handleDeleteMatch(tournament.id, matchId)}
                  getVersion={getVersion}
                  getDeck={getDeck}
                />
              ))
            )}
          </div>
        </>
      )}

      {showTournamentModal && (
        <TournamentModal
          tournament={editingTournament}
          onSave={handleSaveTournament}
          onClose={() => {
            setShowTournamentModal(false)
            setEditingTournament(null)
          }}
        />
      )}

      {showMatchModal && editingMatch && (
        <MatchModal
          match={editingMatch.match}
          isFreeplay={isFreeplayTournament(editingMatch.tournamentId)}
          onSave={handleSaveMatch}
          onClose={() => {
            setShowMatchModal(false)
            setEditingMatch(null)
          }}
        />
      )}
    </div>
  )
}
