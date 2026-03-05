import { useState, useEffect } from 'react'
import { useFirestoreDeck, type DeckVersionInfo } from '../../hooks/useFirestoreDeck'
import { LeaderPicker } from './LeaderPicker'
import type { Match, MatchResult, LeaderCard, DeckVersionRef } from '../../types'
import { MATCH_RESULT_LABELS } from '../../types'
import { resolveCardImage } from '../../utils/cardImage'
import './MatchModal.css'

interface MatchModalProps {
  match: Match | null
  isFreeplay?: boolean
  onSave: (data: {
    result: MatchResult
    opponentLeader?: LeaderCard | null
    memo?: string
    myDeckId?: string | null
    myDeckVersion?: DeckVersionRef | null
    myLeader?: LeaderCard | null
  }) => void
  onClose: () => void
}

export function MatchModal({ match, isFreeplay = false, onSave, onClose }: MatchModalProps) {
  const { fetchBranches, getDeck, fetchVersions } = useFirestoreDeck()

  const [result, setResult] = useState<MatchResult>(match?.result || 'win')
  const [opponentLeader, setOpponentLeader] = useState<LeaderCard | null>(
    match?.opponentLeader || null
  )
  const [memo, setMemo] = useState(match?.memo || '')
  const [showLeaderPicker, setShowLeaderPicker] = useState(false)
  const [leaderPickerTarget, setLeaderPickerTarget] = useState<'opponent' | 'my'>('opponent')
  const [isSaving, setIsSaving] = useState(false)

  // フリープレイ用のデッキ選択状態
  const [selectedDeckName, setSelectedDeckName] = useState<string>(match?.myDeckId || '')
  const [selectedVersion, setSelectedVersion] = useState<DeckVersionRef | null>(
    match?.myDeckVersion || null
  )
  const [myLeader, setMyLeader] = useState<LeaderCard | null>(match?.myLeader || null)
  const [savedDecks, setSavedDecks] = useState<{ name: string; leader: LeaderCard | null }[]>([])
  const [deckVersions, setDeckVersions] = useState<DeckVersionInfo[]>([])
  const [loadingDecks, setLoadingDecks] = useState(false)
  const [loadingVersions, setLoadingVersions] = useState(false)

  // フリープレイ時のみデッキ一覧を取得
  useEffect(() => {
    if (!isFreeplay) return

    async function loadDecks() {
      setLoadingDecks(true)
      try {
        const { branches } = await fetchBranches()
        const decksWithLeaders = await Promise.all(
          branches.map(async (branch) => {
            const { leader } = await getDeck(branch.name)
            return {
              name: branch.name,
              leader,
            }
          })
        )
        setSavedDecks(decksWithLeaders)
      } catch (error) {
        console.error('Failed to load decks:', error)
      } finally {
        setLoadingDecks(false)
      }
    }
    loadDecks()
  }, [isFreeplay, fetchBranches, getDeck])

  const handleSelectDeck = async (deckName: string) => {
    setSelectedDeckName(deckName)
    setSelectedVersion(null)
    setDeckVersions([])

    const deck = savedDecks.find((d) => d.name === deckName)
    if (deck) {
      setMyLeader(deck.leader)

      if (deckName) {
        setLoadingVersions(true)
        try {
          const versions = await fetchVersions(deckName, 20)
          setDeckVersions(versions)
        } catch (error) {
          console.error('Failed to load versions:', error)
        } finally {
          setLoadingVersions(false)
        }
      }
    }
  }

  const handleSelectVersion = (versionId: string) => {
    if (!versionId) {
      setSelectedVersion(null)
      return
    }
    const version = deckVersions.find((v) => v.id === versionId)
    if (version) {
      setSelectedVersion({
        versionId: version.id,
        versionNumber: version.versionNumber,
        versionName: version.name,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return

    setIsSaving(true)
    try {
      await Promise.resolve(
        onSave({
          result,
          opponentLeader: opponentLeader || undefined,
          memo: memo.trim() || undefined,
          ...(isFreeplay && {
            myDeckId: selectedDeckName || null,
            myDeckVersion: selectedVersion,
            myLeader: myLeader,
          }),
        })
      )
    } finally {
      setIsSaving(false)
    }
  }

  const openLeaderPicker = (target: 'opponent' | 'my') => {
    setLeaderPickerTarget(target)
    setShowLeaderPicker(true)
  }

  const handleLeaderSelect = (leader: LeaderCard) => {
    if (leaderPickerTarget === 'opponent') {
      setOpponentLeader(leader)
    } else {
      setMyLeader(leader)
    }
    setShowLeaderPicker(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="match-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{match ? '試合を編集' : '試合を追加'}</h2>
          <button className="close-button" onClick={onClose} aria-label="モーダルを閉じる">
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
                    aria-pressed={result === value}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          {isFreeplay && (
            <div className="form-group">
              <label>使用デッキ</label>
              {loadingDecks ? (
                <div className="loading-decks">読み込み中...</div>
              ) : (
                <>
                  {savedDecks.length > 0 && (
                    <select
                      className="deck-select"
                      onChange={(e) => handleSelectDeck(e.target.value)}
                      value={selectedDeckName}
                    >
                      <option value="">保存済みデッキから選択...</option>
                      {savedDecks.map((deck) => (
                        <option key={deck.name} value={deck.name}>
                          {deck.name} {deck.leader ? `(${deck.leader.name})` : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {selectedDeckName && (
                    <div className="version-selection">
                      <label htmlFor="deck-version">バージョン（任意）</label>
                      {loadingVersions ? (
                        <div className="loading-versions">読み込み中...</div>
                      ) : deckVersions.length > 0 ? (
                        <select
                          id="deck-version"
                          className="version-select"
                          value={selectedVersion?.versionId || ''}
                          onChange={(e) => handleSelectVersion(e.target.value)}
                        >
                          <option value="">現在のバージョン</option>
                          {deckVersions.map((version) => (
                            <option key={version.id} value={version.id}>
                              v{version.versionNumber}
                              {version.name ? ` - ${version.name}` : ''}
                              {version.type === 'auto' ? ' (自動)' : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="no-versions">バージョン履歴がありません</div>
                      )}
                    </div>
                  )}

                  <div className="leader-selection my-leader">
                    {myLeader ? (
                      <div className="selected-leader">
                        <img
                          src={resolveCardImage(myLeader.image, myLeader.id)}
                          alt={myLeader.name}
                        />
                        <span>{myLeader.name}</span>
                        <button
                          type="button"
                          className="clear-leader"
                          onClick={() => setMyLeader(null)}
                          aria-label="自分のリーダーを解除"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="select-leader-btn"
                        onClick={() => openLeaderPicker('my')}
                      >
                        リーダーを選択
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="form-group">
            <label>相手リーダー</label>
            <div className="leader-selection">
              {opponentLeader ? (
                <div className="selected-leader">
                  <img
                    src={resolveCardImage(opponentLeader.image, opponentLeader.id)}
                    alt={opponentLeader.name}
                  />
                  <span>{opponentLeader.name}</span>
                  <button
                    type="button"
                    className="clear-leader"
                    onClick={() => setOpponentLeader(null)}
                    aria-label="相手リーダーを解除"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="select-leader-btn"
                  onClick={() => openLeaderPicker('opponent')}
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
            <button type="submit" className="save-button" disabled={isSaving}>
              保存
            </button>
          </div>
        </form>

        {showLeaderPicker && (
          <LeaderPicker onSelect={handleLeaderSelect} onClose={() => setShowLeaderPicker(false)} />
        )}
      </div>
    </div>
  )
}
