import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './App.css'
import { exportDeckToPDF } from './utils/pdfExport'

interface Series {
  id: string
  name: string
}

interface Card {
  id: string
  name: string
  image: string
  series_id?: string
  // all_cards.jsonからの詳細情報
  rarity?: string
  card_type?: string
  cost?: string
  life?: string
  power?: string
  counter?: string
  color?: string
  attribute?: string
  feature?: string
}

interface DeckCard extends Card {
  count: number
}

interface BranchInfo {
  name: string
  parent: string | null
  deck_count: number
  created_at: string
  updated_at: string
}

const API_BASE = 'http://localhost:8000'
const MAX_DECK_SIZE = 50
const MAX_COPIES = 4

function App() {
  const [cards, setCards] = useState<Card[]>([])
  const [deck, setDeck] = useState<DeckCard[]>([])
  const [leader, setLeader] = useState<Card | null>(null)
  const [loading, setLoading] = useState(true)

  // ブランチ関連の状態
  const [currentBranch, setCurrentBranch] = useState('main')
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // PDF生成状態
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [pdfSelectedCards, setPdfSelectedCards] = useState<Map<string, number>>(new Map())
  const [pdfIncludeLeader, setPdfIncludeLeader] = useState(true)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [pdfProgress, setPdfProgress] = useState(0)
  const [pdfLoadedCount, setPdfLoadedCount] = useState(0)
  const [pdfTotalCount, setPdfTotalCount] = useState(0)

  // フィルター・検索
  const [series, setSeries] = useState<Series[]>([])
  const [selectedSeries, setSelectedSeries] = useState<string[]>([])
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedCardTypes, setSelectedCardTypes] = useState<string[]>([])
  const [selectedRarities, setSelectedRarities] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // 色一覧
  const colors = ['赤', '緑', '青', '紫', '黒', '黄']

  // カードタイプ一覧
  const cardTypes = ['LEADER', 'CHARACTER', 'EVENT', 'STAGE']

  // レアリティ一覧
  const rarities = ['L', 'C', 'UC', 'R', 'SR', 'SEC', 'SP']

  // フィルタートグル
  const toggleFilter = (
    current: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    if (current.includes(value)) {
      setter(current.filter(v => v !== value))
    } else {
      setter([...current, value])
    }
  }

  const deckCount = deck.reduce((sum, card) => sum + card.count, 0)

  // ブランチ一覧を取得
  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/branches`)
      const data = await res.json()
      setBranches(data.branches)
      setCurrentBranch(data.current_branch)
    } catch (err) {
      console.error('Failed to fetch branches:', err)
    }
  }, [])

  // ブランチのデッキを読み込む
  const loadBranchDeck = useCallback(async (branchName: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/deck/${branchName}`)
      const data = await res.json()
      setDeck(data.deck || [])
      setLeader(data.leader || null)
      setHasUnsavedChanges(false)
    } catch (err) {
      console.error('Failed to load deck:', err)
    }
  }, [])

  // 初期化
  useEffect(() => {
    const init = async () => {
      try {
        const [cardsRes, branchesRes, seriesRes, cardsDataRes] = await Promise.all([
          fetch(`${API_BASE}/api/cards`),
          fetch(`${API_BASE}/api/branches`),
          fetch(`${API_BASE}/api/series`),
          fetch(`${API_BASE}/api/cards/data`)
        ])
        const cardsListData = await cardsRes.json()
        const branchesData = await branchesRes.json()
        const seriesData = await seriesRes.json()
        const allCardsData = await cardsDataRes.json()

        // カード一覧にall_cards.jsonの詳細情報をマージ
        const cardsWithDetails = cardsListData.cards.map((card: Card) => {
          const details = allCardsData.cards?.[card.id] || {}
          return {
            ...card,
            name: details.name || card.name,
            rarity: details.rarity,
            card_type: details.card_type,
            cost: details.cost,
            life: details.life,
            power: details.power,
            counter: details.counter,
            color: details.color,
            attribute: details.attribute,
            feature: details.feature,
          }
        })

        setCards(cardsWithDetails)
        setBranches(branchesData.branches)
        setCurrentBranch(branchesData.current_branch)
        setSeries(seriesData.series || [])

        // 現在のブランチのデッキを読み込む
        const deckRes = await fetch(`${API_BASE}/api/deck/${branchesData.current_branch}`)
        const deckData = await deckRes.json()
        setDeck(deckData.deck || [])
        setLeader(deckData.leader || null)

        setLoading(false)
      } catch (err) {
        console.error('Failed to initialize:', err)
        setLoading(false)
      }
    }
    init()
  }, [])

  // フィルター済みカード
  const filteredCards = cards.filter(card => {
    // シリーズフィルター
    if (selectedSeries.length > 0 && !selectedSeries.includes(card.series_id || '')) {
      return false
    }
    // 色フィルター（カードの色がいずれかの選択色を含む）
    if (selectedColors.length > 0) {
      const hasColor = selectedColors.some(c => card.color?.includes(c))
      if (!hasColor) return false
    }
    // カードタイプフィルター
    if (selectedCardTypes.length > 0 && !selectedCardTypes.includes(card.card_type || '')) {
      return false
    }
    // レアリティフィルター
    if (selectedRarities.length > 0 && !selectedRarities.includes(card.rarity || '')) {
      return false
    }
    // 検索フィルター（カードID or カード名）
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchId = card.id.toLowerCase().includes(q)
      const matchName = card.name?.toLowerCase().includes(q)
      if (!matchId && !matchName) return false
    }
    return true
  })

  // フィルターが有効かどうか
  const hasActiveFilters = searchQuery || selectedSeries.length > 0 || selectedColors.length > 0 || selectedCardTypes.length > 0 || selectedRarities.length > 0

  // フィルターをリセット
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedSeries([])
    setSelectedColors([])
    setSelectedCardTypes([])
    setSelectedRarities([])
  }

  // デッキを保存
  const saveDeck = async () => {
    try {
      await fetch(`${API_BASE}/api/deck/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: currentBranch, deck, leader })
      })
      setHasUnsavedChanges(false)
      fetchBranches()
    } catch (err) {
      console.error('Failed to save deck:', err)
    }
  }

  // リーダーを設定
  const setLeaderCard = (card: Card) => {
    if (card.card_type !== 'LEADER') return
    setLeader(card)
    setHasUnsavedChanges(true)

    // リーダーの色でフィルターを自動設定
    if (card.color) {
      const leaderColors = colors.filter(c => card.color?.includes(c))
      if (leaderColors.length > 0) {
        setSelectedColors(leaderColors)
      }
    }
  }

  // リーダーを解除
  const removeLeader = () => {
    setLeader(null)
    setHasUnsavedChanges(true)
  }

  // ブランチを作成
  const createBranch = async () => {
    if (!newBranchName.trim()) return

    try {
      await fetch(`${API_BASE}/api/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBranchName, from_branch: currentBranch })
      })
      setNewBranchName('')
      setShowBranchModal(false)
      await fetchBranches()
      // 新しいブランチにチェックアウト
      await checkoutBranch(newBranchName)
    } catch (err) {
      console.error('Failed to create branch:', err)
    }
  }

  // ブランチを切り替え
  const checkoutBranch = async (branchName: string) => {
    if (hasUnsavedChanges) {
      if (!confirm('未保存の変更があります。破棄してブランチを切り替えますか？')) {
        return
      }
    }

    try {
      await fetch(`${API_BASE}/api/branches/${branchName}/checkout`, {
        method: 'POST'
      })
      setCurrentBranch(branchName)
      await loadBranchDeck(branchName)
    } catch (err) {
      console.error('Failed to checkout branch:', err)
    }
  }

  // ブランチを削除
  const deleteBranch = async (branchName: string) => {
    if (branchName === 'main') return
    if (!confirm(`ブランチ "${branchName}" を削除しますか？`)) return

    try {
      await fetch(`${API_BASE}/api/branches/${branchName}`, {
        method: 'DELETE'
      })
      await fetchBranches()
      if (currentBranch === branchName) {
        await checkoutBranch('main')
      }
    } catch (err) {
      console.error('Failed to delete branch:', err)
    }
  }

  // ブランチをmainにマージ
  const mergeBranch = async (sourceBranch: string) => {
    if (!confirm(`"${sourceBranch}" を "main" にマージしますか？`)) return

    try {
      await fetch(`${API_BASE}/api/branches/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: sourceBranch, target: 'main' })
      })
      setShowMergeModal(false)
      await fetchBranches()
    } catch (err) {
      console.error('Failed to merge branch:', err)
    }
  }

  const addToDeck = (card: Card) => {
    // リーダーの場合はリーダーとして設定
    if (card.card_type === 'LEADER') {
      setLeaderCard(card)
      return
    }

    if (deckCount >= MAX_DECK_SIZE) return

    setDeck(prev => {
      const existing = prev.find(c => c.id === card.id)
      if (existing) {
        if (existing.count >= MAX_COPIES) return prev
        return prev.map(c =>
          c.id === card.id ? { ...c, count: c.count + 1 } : c
        )
      }
      return [...prev, { ...card, count: 1 }]
    })
    setHasUnsavedChanges(true)
  }

  const removeFromDeck = (cardId: string) => {
    setDeck(prev => {
      const existing = prev.find(c => c.id === cardId)
      if (!existing) return prev
      if (existing.count === 1) {
        return prev.filter(c => c.id !== cardId)
      }
      return prev.map(c =>
        c.id === cardId ? { ...c, count: c.count - 1 } : c
      )
    })
    setHasUnsavedChanges(true)
  }

  const clearDeck = () => {
    setDeck([])
    setLeader(null)
    setHasUnsavedChanges(true)
  }

  // PDF出力モーダルを開く
  const openPdfModal = () => {
    if (deck.length === 0 && !leader) return
    // デッキのカードを初期選択状態にする
    const initialSelection = new Map<string, number>()
    deck.forEach(card => {
      initialSelection.set(card.id, card.count)
    })
    setPdfSelectedCards(initialSelection)
    setPdfIncludeLeader(!!leader)
    setShowPdfModal(true)
  }

  // PDF選択モーダルでカード枚数を変更
  const updatePdfCardCount = (cardId: string, delta: number) => {
    setPdfSelectedCards(prev => {
      const newMap = new Map(prev)
      const deckCard = deck.find(c => c.id === cardId)
      if (!deckCard) return prev
      const current = newMap.get(cardId) || 0
      const newCount = Math.max(0, Math.min(deckCard.count, current + delta))
      if (newCount === 0) {
        newMap.delete(cardId)
      } else {
        newMap.set(cardId, newCount)
      }
      return newMap
    })
  }

  // PDF選択の合計枚数
  const pdfTotalCards = Array.from(pdfSelectedCards.values()).reduce((sum, count) => sum + count, 0) + (pdfIncludeLeader && leader ? 1 : 0)

  // PDF出力実行
  const handleExportPDF = async () => {
    setShowPdfModal(false)
    setIsGeneratingPDF(true)
    setPdfProgress(0)
    setPdfLoadedCount(0)
    setPdfTotalCount(0)

    // 選択されたカードでデッキを作成
    const selectedDeck = deck
      .filter(card => pdfSelectedCards.has(card.id))
      .map(card => ({
        ...card,
        count: pdfSelectedCards.get(card.id) || 0
      }))
      .filter(card => card.count > 0)

    const result = await exportDeckToPDF({
      deck: selectedDeck,
      leader: pdfIncludeLeader ? leader : null,
      apiBase: API_BASE,
      onProgress: (progress, loaded, total) => {
        setPdfProgress(progress)
        setPdfLoadedCount(loaded)
        setPdfTotalCount(total)
      }
    })

    setIsGeneratingPDF(false)

    if (!result.success) {
      alert(`PDF生成に失敗しました: ${result.error}`)
    } else if (result.failedImages && result.failedImages.length > 0) {
      alert(
        `PDFを生成しました（${result.failedImages.length}枚の画像が読み込めませんでした）`
      )
    }
  }

  const getCardCount = (cardId: string) => {
    return deck.find(c => c.id === cardId)?.count || 0
  }

  if (loading) {
    return <div className="loading">読み込み中...</div>
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>OP TCG デッキビルダー</h1>
          <Link to="/admin" className="admin-link">Admin</Link>
        </div>
        <div className="branch-controls">
          <div className="current-branch">
            <span className="branch-icon">&#9673;</span>
            <span>{currentBranch}</span>
            {hasUnsavedChanges && <span className="unsaved-indicator">*</span>}
          </div>
          <button onClick={() => setShowBranchModal(true)}>
            + 新規ブランチ
          </button>
          <button onClick={() => setShowMergeModal(true)}>
            マージ
          </button>
          <button onClick={saveDeck} disabled={!hasUnsavedChanges}>
            保存
          </button>
        </div>
      </header>

      {/* ブランチ一覧サイドバー */}
      <div className="branch-sidebar">
        <h3>ブランチ</h3>
        <ul className="branch-list">
          {branches.map(branch => (
            <li
              key={branch.name}
              className={`branch-item ${branch.name === currentBranch ? 'active' : ''}`}
            >
              <div className="branch-info" onClick={() => checkoutBranch(branch.name)}>
                <span className="branch-name">
                  {branch.name === 'main' ? '● ' : '○ '}
                  {branch.name}
                </span>
                <span className="branch-deck-count">{branch.deck_count}枚</span>
              </div>
              {branch.name !== 'main' && (
                <button
                  className="branch-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteBranch(branch.name)
                  }}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="main-content">
        <section className="card-pool">
          <div className="card-pool-header">
            <h2>カードプール ({filteredCards.length}/{cards.length}枚)</h2>
            <div className="filter-controls">
              <input
                type="text"
                className="search-input"
                placeholder="ID/名前で検索..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {hasActiveFilters && (
                <button className="clear-filter" onClick={clearFilters}>
                  クリア
                </button>
              )}
            </div>
            <div className="filter-chips">
              <div className="filter-group">
                <span className="filter-label">色:</span>
                {colors.map(c => (
                  <button
                    key={c}
                    className={`filter-chip ${selectedColors.includes(c) ? 'active' : ''}`}
                    onClick={() => toggleFilter(selectedColors, setSelectedColors, c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="filter-group">
                <span className="filter-label">タイプ:</span>
                {cardTypes.map(t => (
                  <button
                    key={t}
                    className={`filter-chip ${selectedCardTypes.includes(t) ? 'active' : ''}`}
                    onClick={() => toggleFilter(selectedCardTypes, setSelectedCardTypes, t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="filter-group">
                <span className="filter-label">レア:</span>
                {rarities.map(r => (
                  <button
                    key={r}
                    className={`filter-chip ${selectedRarities.includes(r) ? 'active' : ''}`}
                    onClick={() => toggleFilter(selectedRarities, setSelectedRarities, r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="filter-group">
                <span className="filter-label">シリーズ:</span>
                <select
                  className="filter-select"
                  value=""
                  onChange={e => {
                    if (e.target.value) toggleFilter(selectedSeries, setSelectedSeries, e.target.value)
                  }}
                >
                  <option value="">選択...</option>
                  {series.filter(s => !selectedSeries.includes(s.id)).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {selectedSeries.map(sid => {
                  const s = series.find(x => x.id === sid)
                  return (
                    <button
                      key={sid}
                      className="filter-chip active"
                      onClick={() => toggleFilter(selectedSeries, setSelectedSeries, sid)}
                    >
                      {s?.name || sid} ×
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="card-grid">
            {filteredCards.map(card => (
              <div
                key={card.id}
                className={`card-item ${getCardCount(card.id) >= MAX_COPIES ? 'maxed' : ''}`}
                onClick={() => addToDeck(card)}
              >
                <img
                  src={`${API_BASE}${card.image}`}
                  alt={card.name}
                  loading="lazy"
                />
                {getCardCount(card.id) > 0 && (
                  <div className="card-count">{getCardCount(card.id)}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <aside className="deck-panel">
          <div className="deck-header">
            <h2>デッキ ({deckCount}/{MAX_DECK_SIZE})</h2>
            <div className="deck-actions">
              <button
                onClick={openPdfModal}
                disabled={deck.length === 0 && !leader}
                className="export-button"
              >
                PDF出力
              </button>
              <button onClick={clearDeck} disabled={deck.length === 0 && !leader}>
                クリア
              </button>
            </div>
          </div>

          {/* リーダー */}
          <div className="leader-section">
            <h3>リーダー</h3>
            {leader ? (
              <div className="leader-card">
                <img
                  src={`${API_BASE}${leader.image}`}
                  alt={leader.name}
                />
                <div className="leader-info">
                  <span className="leader-name">{leader.name}</span>
                  <span className="leader-color">{leader.color}</span>
                  <button onClick={removeLeader} className="leader-remove">×</button>
                </div>
              </div>
            ) : (
              <div className="leader-empty">
                リーダーを選択してください
              </div>
            )}
          </div>

          {deckCount === MAX_DECK_SIZE && leader && (
            <div className="deck-complete">デッキ完成!</div>
          )}

          <div className="deck-list">
            {deck.map(card => (
              <div key={card.id} className="deck-card">
                <img
                  src={`${API_BASE}${card.image}`}
                  alt={card.name}
                />
                <div className="deck-card-info">
                  <span className="deck-card-name">{card.name}</span>
                  <div className="deck-card-controls">
                    <button onClick={() => removeFromDeck(card.id)}>-</button>
                    <span>{card.count}</span>
                    <button
                      onClick={() => addToDeck(card)}
                      disabled={card.count >= MAX_COPIES || deckCount >= MAX_DECK_SIZE}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* 新規ブランチモーダル */}
      {showBranchModal && (
        <div className="modal-overlay" onClick={() => setShowBranchModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>新規ブランチを作成</h3>
            <p className="modal-desc">
              現在のブランチ "{currentBranch}" から新しいブランチを作成します
            </p>
            <input
              type="text"
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              placeholder="ブランチ名"
              onKeyDown={e => e.key === 'Enter' && createBranch()}
            />
            <div className="modal-actions">
              <button onClick={() => setShowBranchModal(false)}>キャンセル</button>
              <button onClick={createBranch} className="primary">作成</button>
            </div>
          </div>
        </div>
      )}

      {/* マージモーダル */}
      {showMergeModal && (
        <div className="modal-overlay" onClick={() => setShowMergeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>ブランチをmainにマージ</h3>
            <p className="modal-desc">
              選択したブランチのデッキをmainに統合します
            </p>
            <div className="merge-branch-list">
              {branches.filter(b => b.name !== 'main').map(branch => (
                <button
                  key={branch.name}
                  className="merge-branch-item"
                  onClick={() => mergeBranch(branch.name)}
                >
                  {branch.name} ({branch.deck_count}枚) → main
                </button>
              ))}
              {branches.filter(b => b.name !== 'main').length === 0 && (
                <p>マージ可能なブランチがありません</p>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowMergeModal(false)}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF出力選択モーダル */}
      {showPdfModal && (
        <div className="modal-overlay" onClick={() => setShowPdfModal(false)}>
          <div className="modal pdf-select-modal" onClick={e => e.stopPropagation()}>
            <h3>PDF出力するカードを選択</h3>
            <p className="modal-desc">
              出力するカードと枚数を選択してください（合計: {pdfTotalCards}枚）
            </p>

            {/* リーダー選択 */}
            {leader && (
              <div className="pdf-leader-select">
                <label className="pdf-checkbox-label">
                  <input
                    type="checkbox"
                    checked={pdfIncludeLeader}
                    onChange={e => setPdfIncludeLeader(e.target.checked)}
                  />
                  <img src={`${API_BASE}${leader.image}`} alt={leader.name} />
                  <span className="pdf-card-name">{leader.name}</span>
                  <span className="pdf-card-type">リーダー</span>
                </label>
              </div>
            )}

            {/* デッキカード選択 */}
            <div className="pdf-card-list">
              {deck.map(card => {
                const selectedCount = pdfSelectedCards.get(card.id) || 0
                return (
                  <div key={card.id} className="pdf-card-item">
                    <img src={`${API_BASE}${card.image}`} alt={card.name} />
                    <div className="pdf-card-info">
                      <span className="pdf-card-name">{card.name}</span>
                      <span className="pdf-card-max">最大: {card.count}枚</span>
                    </div>
                    <div className="pdf-card-controls">
                      <button
                        onClick={() => updatePdfCardCount(card.id, -1)}
                        disabled={selectedCount === 0}
                      >
                        -
                      </button>
                      <span>{selectedCount}</span>
                      <button
                        onClick={() => updatePdfCardCount(card.id, 1)}
                        disabled={selectedCount >= card.count}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowPdfModal(false)}>キャンセル</button>
              <button
                onClick={handleExportPDF}
                className="primary"
                disabled={pdfTotalCards === 0}
              >
                PDF出力 ({pdfTotalCards}枚)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF生成モーダル */}
      {isGeneratingPDF && (
        <div className="modal-overlay">
          <div className="modal pdf-modal">
            <h3>PDF生成中...</h3>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${pdfProgress}%` }}
              />
            </div>
            <p className="progress-text">
              {pdfProgress}% - 画像読込中 ({pdfLoadedCount}/{pdfTotalCount})
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
