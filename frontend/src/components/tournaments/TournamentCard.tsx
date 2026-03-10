import type { TournamentWithMatches, Match } from '../../types'
import { TOURNAMENT_TYPE_LABELS } from '../../types'
import { resolveCardImage } from '../../utils/cardImage'
import { shareTournamentResult } from '../../utils/tweetGenerator'
import { MatchList } from './MatchList'
import './TournamentCard.css'

interface TournamentCardProps {
  tournament: TournamentWithMatches
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onDelete: () => void
  onAddMatch: () => void
  onEditMatch: (match: Match) => void
  onDeleteMatch: (matchId: string) => void
}

export function TournamentCard({
  tournament,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddMatch,
  onEditMatch,
  onDeleteMatch,
}: TournamentCardProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric',
      day: 'numeric',
    }).format(date)
  }

  const typeLabel =
    tournament.type === 'other' && tournament.customTypeName
      ? tournament.customTypeName
      : TOURNAMENT_TYPE_LABELS[tournament.type]

  const recordText = `${tournament.wins}勝${tournament.losses}敗${tournament.draws > 0 ? tournament.draws + '分' : ''}`

  return (
    <div className={`tournament-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="tournament-card-header" onClick={onToggleExpand}>
        <button className="expand-button" aria-label={isExpanded ? '折りたたむ' : '展開する'}>
          {isExpanded ? '▼' : '▶'}
        </button>

        <div className="tournament-info">
          <div className="tournament-main-row">
            <span className="tournament-type-badge">{typeLabel}</span>
            <span className="tournament-date">{formatDate(tournament.date)}</span>
            <span className="tournament-record">{recordText}</span>
          </div>
          <div className="tournament-name">{tournament.name}</div>
          {tournament.myLeader && (
            <div className="tournament-deck">
              <img
                src={resolveCardImage(tournament.myLeader.image, tournament.myLeader.id)}
                alt={tournament.myLeader.name}
                className="leader-thumbnail"
              />
              <span>
                {tournament.myLeader.name}
                {tournament.myDeckVersion && (
                  <span className="deck-version-badge">
                    v{tournament.myDeckVersion.versionNumber}
                    {tournament.myDeckVersion.versionName && ` ${tournament.myDeckVersion.versionName}`}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="tournament-winrate">
          {tournament.winRate.toFixed(1)}%
        </div>
      </div>

      {isExpanded && (
        <div className="tournament-card-body">
          <div className="tournament-actions">
            <button className="action-button edit" onClick={onEdit}>
              編集
            </button>
            <button className="action-button delete" onClick={onDelete}>
              削除
            </button>
            <button
              className="action-button tweet"
              onClick={() => shareTournamentResult(tournament)}
              title="結果をツイート"
            >
              𝕏
            </button>
          </div>

          <MatchList
            matches={tournament.matches}
            isFreeplay={tournament.type === 'freeplay'}
            onAddMatch={onAddMatch}
            onEditMatch={onEditMatch}
            onDeleteMatch={onDeleteMatch}
          />
        </div>
      )}
    </div>
  )
}
