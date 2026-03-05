import { useState } from 'react'
import { LeaderPicker } from './LeaderPicker'
import type { Match, MatchResult, LeaderCard } from '../../types'
import { MATCH_RESULT_LABELS } from '../../types'
import { resolveCardImage } from '../../utils/cardImage'
import './MatchModal.css'

interface MatchModalProps {
  match: Match | null
  onSave: (data: {
    result: MatchResult
    opponentLeader?: LeaderCard
    memo?: string
  }) => void
  onClose: () => void
}

export function MatchModal({ match, onSave, onClose }: MatchModalProps) {
  const [result, setResult] = useState<MatchResult>(match?.result || 'win')
  const [opponentLeader, setOpponentLeader] = useState<LeaderCard | null>(
    match?.opponentLeader || null
  )
  const [memo, setMemo] = useState(match?.memo || '')
  const [showLeaderPicker, setShowLeaderPicker] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    onSave({
      result,
      opponentLeader: opponentLeader || undefined,
      memo: memo.trim() || undefined,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="match-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{match ? '試合を編集' : '試合を追加'}</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>結果</label>
            <div className="result-buttons">
              {(Object.entries(MATCH_RESULT_LABELS) as [MatchResult, string][]).map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`result-button ${value} ${result === value ? 'selected' : ''}`}
                    onClick={() => setResult(value)}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="form-group">
            <label>相手リーダー</label>
            <div className="leader-selection">
              {opponentLeader ? (
                <div className="selected-leader">
                  <img src={resolveCardImage(opponentLeader.image, opponentLeader.id)} alt={opponentLeader.name} />
                  <span>{opponentLeader.name}</span>
                  <button
                    type="button"
                    className="clear-leader"
                    onClick={() => setOpponentLeader(null)}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="select-leader-btn"
                  onClick={() => setShowLeaderPicker(true)}
                >
                  相手リーダーを選択
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="match-memo">メモ</label>
            <textarea
              id="match-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="対戦メモ（任意）"
              rows={3}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="save-button">
              保存
            </button>
          </div>
        </form>

        {showLeaderPicker && (
          <LeaderPicker
            onSelect={(leader) => {
              setOpponentLeader(leader)
              setShowLeaderPicker(false)
            }}
            onClose={() => setShowLeaderPicker(false)}
          />
        )}
      </div>
    </div>
  )
}
