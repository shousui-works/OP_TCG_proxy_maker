import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTournaments } from '../hooks/useTournaments'
import { useMatches } from '../hooks/useMatches'
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
} from '../types'
import './TournamentsPage.css'

export function TournamentsPage() {
  const navigate = useNavigate()
  const { user, isFirebaseEnabled } = useAuth()
  const { fetchTournaments, createTournament, updateTournament, deleteTournament } =
    useTournaments()
  const { createMatch, updateMatch, deleteMatch } = useMatches()

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
    myDeckId?: string
    myLeader?: LeaderCard
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
    opponentLeader?: LeaderCard
    memo?: string
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

  // Show message if Firebase is disabled
  if (!isFirebaseEnabled) {
    return (
      <div className="tournaments-page">
        <header className="tournaments-header">
          <button className="back-button" onClick={() => navigate('/')}>
            ← 戻る
          </button>
          <h1>大会管理</h1>
        </header>
        <div className="login-prompt">
          <p>大会管理機能は現在利用できません。</p>
        </div>
      </div>
    )
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="tournaments-page">
        <header className="tournaments-header">
          <button className="back-button" onClick={() => navigate('/')}>
            ← 戻る
          </button>
          <h1>大会管理</h1>
        </header>
        <div className="login-prompt">
          <p>大会管理機能を使用するにはログインが必要です。</p>
          <LoginButton />
        </div>
      </div>
    )
  }

  return (
    <div className="tournaments-page">
      <header className="tournaments-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← 戻る
        </button>
        <h1>大会管理</h1>
        <button className="add-tournament-button" onClick={handleAddTournament}>
          + 追加
        </button>
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
