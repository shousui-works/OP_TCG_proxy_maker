import type { Match } from '../../types'
import { MATCH_RESULT_LABELS } from '../../types'
import { resolveCardImage } from '../../utils/cardImage'
import './MatchList.css'

interface MatchListProps {
  matches: Match[]
  isFreeplay?: boolean
  onAddMatch: () => void
  onEditMatch: (match: Match) => void
  onDeleteMatch: (matchId: string) => void
}

export function MatchList({
  matches,
  isFreeplay = false,
  onAddMatch,
  onEditMatch,
  onDeleteMatch,
}: MatchListProps) {
  const getResultClass = (result: string) => {
    switch (result) {
      case 'win':
        return 'result-win'
      case 'loss':
        return 'result-loss'
      case 'draw':
        return 'result-draw'
      default:
        return ''
    }
  }

  return (
    <div className="match-list">
      <div className="match-list-header">
        <span>試合記録</span>
        <button className="add-match-button" onClick={onAddMatch}>
          + 試合追加
        </button>
      </div>

      {matches.length === 0 ? (
        <div className="no-matches">試合記録がありません</div>
      ) : (
        <div className="matches">
          {matches.map((match) => (
            <div key={match.id} className="match-item">
              <span className="match-round">R{match.order}</span>
              <span className={`match-result ${getResultClass(match.result)}`}>
                {MATCH_RESULT_LABELS[match.result]}
              </span>
              {isFreeplay && match.myLeader && (
                <div className="my-leader">
                  <img
                    src={resolveCardImage(match.myLeader.image, match.myLeader.id)}
                    alt={match.myLeader.name}
                    className="my-leader-img"
                  />
                  {match.myDeckVersion && (
                    <span className="my-deck-version">v{match.myDeckVersion.versionNumber}</span>
                  )}
                </div>
              )}
              {match.opponentLeader ? (
                <div className="opponent-leader">
                  <span>vs</span>
                  <img
                    src={resolveCardImage(match.opponentLeader.image, match.opponentLeader.id)}
                    alt={match.opponentLeader.name}
                    className="opponent-leader-img"
                  />
                  <span className="opponent-leader-name">
                    {match.opponentLeader.name}
                  </span>
                </div>
              ) : (
                <span className="no-opponent">vs 不明</span>
              )}
              {match.memo && <span className="match-memo-indicator" title={match.memo}>📝</span>}
              <div className="match-actions">
                <button
                  className="match-action-btn"
                  onClick={() => onEditMatch(match)}
                  title="編集"
                  aria-label="試合を編集"
                >
                  ✏️
                </button>
                <button
                  className="match-action-btn delete"
                  onClick={() => onDeleteMatch(match.id)}
                  title="削除"
                  aria-label="試合を削除"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
