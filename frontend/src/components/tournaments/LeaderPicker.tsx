import { useState, useEffect, useMemo, useRef } from 'react'
import type { LeaderCard, Card } from '../../types'
import { resolveCardImage } from '../../utils/cardImage'
import { normalizeForSearch } from '../../utils/textNormalize'
import './LeaderPicker.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const MIN_SEARCH_LENGTH = 1

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
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [colorFilter, setColorFilter] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 検索ボックスに自動フォーカス
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    async function fetchCards() {
      try {
        setError(null)
        const res = await fetch(`${API_BASE}/api/cards/data`)
        if (!res.ok) throw new Error('Failed to fetch cards')
        const data = await res.json()
        // data.cardsはオブジェクト形式（{cardId: cardData}）なので配列に変換
        const cardsObj = data.cards || {}
        const cardsArray = Object.values(cardsObj) as Card[]
        setAllCards(cardsArray)
      } catch (err) {
        console.error('Failed to fetch cards:', err)
        setError('カードデータの読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }
    fetchCards()
  }, [])

  const leaders = useMemo(() => {
    return allCards.filter((card) => card.card_type === 'LEADER')
  }, [allCards])

  // 検索または色フィルターがあるかどうか
  const hasSearchQuery = search.length >= MIN_SEARCH_LENGTH || colorFilter !== ''

  const filteredLeaders = useMemo(() => {
    // 検索条件がない場合は空配列を返す
    if (!hasSearchQuery) {
      return []
    }

    // 検索クエリの正規化はループ外で1回だけ実行
    const normalizedQuery = search ? normalizeForSearch(search) : ''

    return leaders.filter((leader) => {
      // Search filter
      if (normalizedQuery) {
        const matchesName = normalizeForSearch(leader.name).includes(normalizedQuery)
        const matchesId = normalizeForSearch(leader.id).includes(normalizedQuery)

        if (!matchesName && !matchesId) return false
      }

      // Color filter
      if (colorFilter) {
        if (!leader.color?.includes(colorFilter)) return false
      }

      return true
    })
  }, [leaders, search, colorFilter, hasSearchQuery])

  const handleSelect = (card: Card) => {
    onSelect({
      id: card.id,
      name: card.name,
      image: resolveCardImage(card.image_url || card.image, card.id),
      color: card.color,
      series_id: card.series_id,
    })
  }

  return (
    <div className="leader-picker-overlay" onClick={onClose}>
      <div className="leader-picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <h3>リーダーを選択</h3>
          <button className="close-button" onClick={onClose} aria-label="リーダー選択を閉じる">
            ×
          </button>
        </div>

        <div className="picker-filters">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="リーダー名を入力して検索..."
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
          ) : error ? (
            <div className="picker-error">{error}</div>
          ) : !hasSearchQuery ? (
            <div className="picker-hint">
              <p>リーダー名または色で検索してください</p>
              <p className="picker-hint-sub">例: ルフィ、ロー、シャンクス</p>
            </div>
          ) : filteredLeaders.length === 0 ? (
            <div className="picker-empty">リーダーが見つかりません</div>
          ) : (
            <div className="leader-grid">
              {filteredLeaders.map((leader) => {
                const imageUrl = resolveCardImage(leader.image_url || leader.image, leader.id)
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
