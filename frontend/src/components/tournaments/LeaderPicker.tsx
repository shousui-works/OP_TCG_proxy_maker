import { useState, useEffect, useMemo } from 'react'
import type { LeaderCard, Card } from '../../types'
import './LeaderPicker.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

interface LeaderPickerProps {
  onSelect: (leader: LeaderCard) => void
  onClose: () => void
}

const COLOR_OPTIONS = [
  { value: '', label: '全色' },
  { value: '赤', label: '赤' },
  { value: '緑', label: '緑' },
  { value: '青', label: '青' },
  { value: '紫', label: '紫' },
  { value: '黒', label: '黒' },
  { value: '黄', label: '黄' },
]

export function LeaderPicker({ onSelect, onClose }: LeaderPickerProps) {
  const [allCards, setAllCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [colorFilter, setColorFilter] = useState('')

  useEffect(() => {
    async function fetchCards() {
      try {
        const res = await fetch(`${API_BASE}/api/cards/data`)
        if (!res.ok) throw new Error('Failed to fetch cards')
        const data = await res.json()
        // data.cardsはオブジェクト形式（{cardId: cardData}）なので配列に変換
        const cardsObj = data.cards || {}
        const cardsArray = Object.values(cardsObj) as Card[]
        setAllCards(cardsArray)
      } catch (error) {
        console.error('Failed to fetch cards:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCards()
  }, [])

  const leaders = useMemo(() => {
    return allCards.filter((card) => card.card_type === 'LEADER')
  }, [allCards])

  const filteredLeaders = useMemo(() => {
    return leaders.filter((leader) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesName = leader.name.toLowerCase().includes(searchLower)
        const matchesId = leader.id.toLowerCase().includes(searchLower)
        if (!matchesName && !matchesId) return false
      }

      // Color filter
      if (colorFilter) {
        if (!leader.color?.includes(colorFilter)) return false
      }

      return true
    })
  }, [leaders, search, colorFilter])

  const handleSelect = (card: Card) => {
    onSelect({
      id: card.id,
      name: card.name,
      image: card.image_url || card.image,
      color: card.color,
      series_id: card.series_id,
    })
  }

  return (
    <div className="leader-picker-overlay" onClick={onClose}>
      <div className="leader-picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <h3>リーダーを選択</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="picker-filters">
          <input
            type="text"
            placeholder="名前で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            className="color-select"
          >
            {COLOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="picker-content">
          {loading ? (
            <div className="picker-loading">読み込み中...</div>
          ) : filteredLeaders.length === 0 ? (
            <div className="picker-empty">リーダーが見つかりません</div>
          ) : (
            <div className="leader-grid">
              {filteredLeaders.map((leader) => {
                const imageUrl = leader.image_url || leader.image
                return (
                  <button
                    key={leader.id}
                    className="leader-item"
                    onClick={() => handleSelect(leader)}
                    title={leader.name}
                  >
                    <img src={imageUrl} alt={leader.name} />
                    <span className="leader-name">{leader.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
