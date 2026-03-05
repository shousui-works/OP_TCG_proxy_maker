import { useState, useEffect } from 'react'
import { useFirestoreDeck, type DeckVersionInfo } from '../../hooks/useFirestoreDeck'
import { LeaderPicker } from './LeaderPicker'
import type { TournamentWithMatches, TournamentType, LeaderCard, DeckVersionRef } from '../../types'
import { TOURNAMENT_TYPE_LABELS } from '../../types'
import { resolveCardImage } from '../../utils/cardImage'
import './TournamentModal.css'

interface TournamentModalProps {
  tournament: TournamentWithMatches | null
  onSave: (data: {
    name: string
    date: Date
    type: TournamentType
    customTypeName?: string
    myDeckId?: string | null
    myDeckVersion?: DeckVersionRef | null
    myLeader?: LeaderCard | null
  }) => void
  onClose: () => void
}

export function TournamentModal({ tournament, onSave, onClose }: TournamentModalProps) {
  const { fetchBranches, getDeck, fetchVersions } = useFirestoreDeck()

  const [name, setName] = useState(tournament?.name || '')
  const [date, setDate] = useState(() => {
    if (tournament?.date) {
      return formatDateForInput(tournament.date)
    }
    return formatDateForInput(new Date())
  })
  const [type, setType] = useState<TournamentType>(tournament?.type || 'flagship')
  const [customTypeName, setCustomTypeName] = useState(tournament?.customTypeName || '')
  const [myLeader, setMyLeader] = useState<LeaderCard | null>(tournament?.myLeader || null)
  const [selectedDeckName, setSelectedDeckName] = useState<string>(tournament?.myDeckId || '')
  const [selectedVersion, setSelectedVersion] = useState<DeckVersionRef | null>(
    tournament?.myDeckVersion || null
  )
  const [showLeaderPicker, setShowLeaderPicker] = useState(false)

  const [savedDecks, setSavedDecks] = useState<
    { name: string; leader: LeaderCard | null }[]
  >([])
  const [deckVersions, setDeckVersions] = useState<DeckVersionInfo[]>([])
  const [loadingDecks, setLoadingDecks] = useState(false)
  const [loadingVersions, setLoadingVersions] = useState(false)

  function formatDateForInput(d: Date): string {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Parse date string as local timezone (not UTC)
  function parseDateFromInput(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // デッキ一覧を取得（キャンセル制御付き）
  useEffect(() => {
    let cancelled = false

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
        if (!cancelled) {
          setSavedDecks(decksWithLeaders)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load decks:', error)
        }
      } finally {
        if (!cancelled) {
          setLoadingDecks(false)
        }
      }
    }
    loadDecks()

    return () => {
      cancelled = true
    }
  }, [fetchBranches, getDeck])

  // バージョン一覧を selectedDeckName が変わったときに読み込む（キャンセル制御付き）
  useEffect(() => {
    // フリープレイの場合はバージョン読み込み不要
    if (type === 'freeplay' || !selectedDeckName) {
      setDeckVersions([])
      return
    }

    let cancelled = false

    async function loadVersions() {
      setLoadingVersions(true)
      try {
        const versions = await fetchVersions(selectedDeckName, 20)
        if (!cancelled) {
          setDeckVersions(versions)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load versions:', error)
        }
      } finally {
        if (!cancelled) {
          setLoadingVersions(false)
        }
      }
    }
    loadVersions()

    return () => {
      cancelled = true
    }
  }, [type, selectedDeckName, fetchVersions])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    // フリープレイの場合はデッキ情報をnullでクリアする
    const isFreeplay = type === 'freeplay'

    onSave({
      name: name.trim(),
      date: parseDateFromInput(date),
      type,
      customTypeName: type === 'other' ? customTypeName : undefined,
      myDeckId: isFreeplay ? null : selectedDeckName || undefined,
      myDeckVersion: isFreeplay ? null : selectedVersion || undefined,
      myLeader: isFreeplay ? null : myLeader || undefined,
    })
  }

  const handleSelectDeck = (deckName: string) => {
    setSelectedDeckName(deckName)
    setSelectedVersion(null)

    const deck = savedDecks.find((d) => d.name === deckName)
    if (deck) {
      // Set leader from deck (null if deck has no leader)
      setMyLeader(deck.leader)
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

  return (
    <div className="tournament-modal-overlay" onClick={onClose}>
      <div className="tournament-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{tournament ? '大会を編集' : '大会を追加'}</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="tournament-name">大会名</label>
            <input
              id="tournament-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: フラッグシップ 東京"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="tournament-date">日付</label>
            <input
              id="tournament-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="tournament-type">大会タイプ</label>
            <select
              id="tournament-type"
              value={type}
              onChange={(e) => setType(e.target.value as TournamentType)}
            >
              {Object.entries(TOURNAMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {type === 'other' && (
            <div className="form-group">
              <label htmlFor="custom-type-name">カスタムタイプ名</label>
              <input
                id="custom-type-name"
                type="text"
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                placeholder="例: 店舗大会"
              />
            </div>
          )}

          {type !== 'freeplay' && (
            <div className="form-group">
              <label>使用デッキ（リーダー）</label>
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
                      <option value="">
                        保存済みデッキから選択...
                      </option>
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

                  <div className="leader-selection">
                    {myLeader ? (
                      <div className="selected-leader">
                        <img src={resolveCardImage(myLeader.image, myLeader.id)} alt={myLeader.name} />
                        <span>{myLeader.name}</span>
                        <button
                          type="button"
                          className="clear-leader"
                          onClick={() => setMyLeader(null)}
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
                        リーダーを選択
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {type === 'freeplay' && (
            <div className="form-group">
              <div className="freeplay-note">
                フリープレイでは、試合ごとに使用デッキを選択できます。
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="save-button" disabled={!name.trim()}>
              保存
            </button>
          </div>
        </form>

        {showLeaderPicker && (
          <LeaderPicker
            onSelect={(leader) => {
              setMyLeader(leader)
              setShowLeaderPicker(false)
            }}
            onClose={() => setShowLeaderPicker(false)}
          />
        )}
      </div>
    </div>
  )
}
