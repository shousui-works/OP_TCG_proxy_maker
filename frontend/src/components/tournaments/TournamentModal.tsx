import { useState, useEffect } from 'react'
import { useFirestoreDeck } from '../../hooks/useFirestoreDeck'
import { LeaderPicker } from './LeaderPicker'
import type { TournamentWithMatches, TournamentType, LeaderCard } from '../../types'
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
    myDeckId?: string
    myLeader?: LeaderCard
  }) => void
  onClose: () => void
}

export function TournamentModal({ tournament, onSave, onClose }: TournamentModalProps) {
  const { fetchBranches, getDeck } = useFirestoreDeck()

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
  const [showLeaderPicker, setShowLeaderPicker] = useState(false)

  const [savedDecks, setSavedDecks] = useState<
    { name: string; leader: LeaderCard | null }[]
  >([])
  const [loadingDecks, setLoadingDecks] = useState(false)

  function formatDateForInput(d: Date): string {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
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
  }, [fetchBranches, getDeck])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    onSave({
      name: name.trim(),
      date: new Date(date),
      type,
      customTypeName: type === 'other' ? customTypeName : undefined,
      myLeader: myLeader || undefined,
    })
  }

  const handleSelectDeck = async (deckName: string) => {
    const deck = savedDecks.find((d) => d.name === deckName)
    if (deck?.leader) {
      setMyLeader(deck.leader)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
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
                    defaultValue=""
                  >
                    <option value="" disabled>
                      保存済みデッキから選択...
                    </option>
                    {savedDecks.map((deck) => (
                      <option key={deck.name} value={deck.name}>
                        {deck.name} {deck.leader ? `(${deck.leader.name})` : ''}
                      </option>
                    ))}
                  </select>
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
