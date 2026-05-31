import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import SEOHead, { createBreadcrumbStructuredData } from '../components/SEOHead'
import PageNav from '../components/PageNav'
import FilterPanel from '../components/FilterPanel'
import VirtualCardGrid from '../components/VirtualCardGrid'
import VirtualDeckList from '../components/VirtualDeckList'
import CardGridSkeleton from '../components/CardGridSkeleton'
import LoginButton from '../components/LoginButton'
import Toast from '../components/Toast'
import { exportDeckToPDF } from '../utils/pdfExport'
import { normalizeForSearch } from '../utils/textNormalize'
import { sortCards, sortDeckCards } from '../utils/cardSort'
import { useAuth } from '../contexts/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import { useProxyList, type ProxyListCard } from '../hooks/useProxyList'
import './ProxyPage.css'

interface Series {
  id: string
  name: string
}

interface Card {
  id: string
  name: string
  image: string
  series_id?: string
  rarity?: string
  card_type?: string
  cost?: string
  life?: string
  power?: string
  counter?: string
  color?: string
  attribute?: string
  feature?: string
  text?: string
}

interface DeckCard extends Card {
  count: number
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const MAX_COPIES = 4
const STORAGE_KEY = 'proxy_selected_cards'

interface NavigationState {
  cards?: Array<{ id: string; name: string; image: string; count: number }>
}

interface StoredCard {
  id: string
  name: string
  image: string
  count: number
}

export function ProxyPage() {
  useAuth() // For LoginButton context
  const { isMobile } = useResponsive()
  const proxyList = useProxyList()
  const location = useLocation()
  const initialCardsProcessed = useRef(false)

  // カードデータ
  const [cards, setCards] = useState<Card[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)

  // 選択カード
  const [selectedCards, setSelectedCards] = useState<Map<string, DeckCard>>(new Map())

  // フィルター
  const [searchQuery, setSearchQuery] = useState('')
  const [featureQuery, setFeatureQuery] = useState('')
  const [selectedSeries, setSelectedSeries] = useState<string[]>([])
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedCardTypes, setSelectedCardTypes] = useState<string[]>([])
  const [selectedRarities, setSelectedRarities] = useState<string[]>([])
  const [selectedCosts, setSelectedCosts] = useState<number[]>([])
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([])
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)

  // PDF生成状態
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [pdfProgress, setPdfProgress] = useState(0)
  const [pdfLoadedCount, setPdfLoadedCount] = useState(0)
  const [pdfTotalCount, setPdfTotalCount] = useState(0)

  // トースト
  const [toastMessage, setToastMessage] = useState('')
  const [showToast, setShowToast] = useState(false)
  const [toastKey, setToastKey] = useState(0)

  // モバイルタブ
  const [activeTab, setActiveTab] = useState<'cards' | 'list' | 'history'>('cards')

  // 履歴関連
  const [history, setHistory] = useState<{ name: string; cardCount: number; updatedAt: string }[]>([])

  const colors = ['赤', '緑', '青', '紫', '黒', '黄']
  const cardTypes = ['LEADER', 'CHARACTER', 'EVENT', 'STAGE']
  const rarities = ['L', 'C', 'UC', 'R', 'SR', 'SEC', 'SP']
  const costs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const attributes = ['打', '斬', '射', '知', '特']

  const showToastNotification = useCallback((message: string) => {
    setToastMessage(message)
    setToastKey(prev => prev + 1)
    setShowToast(true)
  }, [])

  // カードデータ初期化
  useEffect(() => {
    const fetchCards = async () => {
      try {
        const [cardsRes, seriesRes] = await Promise.all([
          fetch(`${API_BASE}/api/cards?include_details=true`),
          fetch(`${API_BASE}/api/series`)
        ])
        if (!cardsRes.ok || !seriesRes.ok) {
          throw new Error('Failed to fetch data')
        }
        const cardsData = await cardsRes.json()
        const seriesData = await seriesRes.json()
        setCards(cardsData.cards || [])
        setSeries(seriesData.series || [])
        setLoading(false)
      } catch (err) {
        console.error('Failed to initialize cards:', err)
        setLoading(false)
      }
    }
    fetchCards()
  }, [])

  // 履歴一覧を取得
  const fetchHistory = useCallback(async () => {
    if (!proxyList.isAuthenticated) return
    try {
      const lists = await proxyList.fetchLists()
      setHistory(lists.map(l => ({
        name: l.name,
        cardCount: l.cards.reduce((sum, c) => sum + c.count, 0),
        updatedAt: l.updatedAt
      })))
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
  }, [proxyList])

  useEffect(() => {
    void fetchHistory()
  }, [fetchHistory])

  // sessionStorageから復元
  useEffect(() => {
    if (initialCardsProcessed.current) return
    if (loading) return // カードデータ読み込み完了を待つ

    initialCardsProcessed.current = true
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const storedCards: StoredCard[] = JSON.parse(stored)
        if (storedCards.length > 0) {
          const newMap = new Map<string, DeckCard>()
          storedCards.forEach(c => {
            const fullCard = cards.find(card => card.id === c.id)
            if (fullCard) {
              newMap.set(c.id, { ...fullCard, count: c.count })
            } else {
              newMap.set(c.id, { id: c.id, name: c.name, image: c.image, count: c.count })
            }
          })
          setSelectedCards(newMap)
        }
      }
    } catch (err) {
      console.error('Failed to restore proxy cards from storage:', err)
    }
  }, [cards, loading])

  // デッキ構築ページから渡されたカードを追加（既存に追加）
  const navigationProcessed = useRef(false)
  useEffect(() => {
    if (navigationProcessed.current) return
    if (loading) return
    if (!initialCardsProcessed.current) return // sessionStorage復元完了を待つ

    const state = location.state as NavigationState | null
    if (state?.cards && state.cards.length > 0) {
      navigationProcessed.current = true
      setSelectedCards(prev => {
        const newMap = new Map(prev)
        state.cards!.forEach(c => {
          const fullCard = cards.find(card => card.id === c.id)
          const existing = newMap.get(c.id)
          if (existing) {
            // 既存カードがあれば枚数を加算
            newMap.set(c.id, { ...existing, count: existing.count + c.count })
          } else if (fullCard) {
            newMap.set(c.id, { ...fullCard, count: c.count })
          } else {
            newMap.set(c.id, { id: c.id, name: c.name, image: c.image, count: c.count })
          }
        })
        return newMap
      })
      // モバイルの場合は選択中タブに切り替え
      if (isMobile) {
        setActiveTab('list')
      }
    }
  }, [location.state, cards, loading, isMobile])

  // 選択カードが変わったらsessionStorageに保存
  useEffect(() => {
    if (!initialCardsProcessed.current) return // 初期化完了前は保存しない

    const cardsToStore: StoredCard[] = Array.from(selectedCards.values()).map(c => ({
      id: c.id,
      name: c.name,
      image: c.image,
      count: c.count
    }))
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cardsToStore))
  }, [selectedCards])

  // 日付フォーマット（履歴名用）
  const formatDateForName = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const h = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    return `${y}${m}${d}_${h}${min}`
  }

  // フィルター済みカード
  const filteredCards = useMemo(() => {
    const normalizedQuery = searchQuery ? normalizeForSearch(searchQuery) : ''
    const normalizedFeatureQuery = featureQuery ? normalizeForSearch(featureQuery) : ''
    return cards
      .filter(card => {
        if (selectedSeries.length > 0 && !selectedSeries.includes(card.series_id || '')) {
          return false
        }
        if (selectedColors.length > 0) {
          const hasColor = selectedColors.some(c => card.color?.includes(c))
          if (!hasColor) return false
        }
        if (selectedCardTypes.length > 0 && !selectedCardTypes.includes(card.card_type || '')) {
          return false
        }
        if (selectedRarities.length > 0 && !selectedRarities.includes(card.rarity || '')) {
          return false
        }
        if (selectedCosts.length > 0) {
          const cardCost = parseInt(card.cost || '-1', 10)
          if (!selectedCosts.includes(cardCost)) return false
        }
        if (selectedAttributes.length > 0) {
          const cardAttr = card.attribute || ''
          const hasMatchingAttr = selectedAttributes.some(attr => cardAttr.includes(attr))
          if (!hasMatchingAttr) return false
        }
        if (normalizedQuery) {
          const matchId = normalizeForSearch(card.id).includes(normalizedQuery)
          const matchName = normalizeForSearch(card.name || '').includes(normalizedQuery)
          if (!matchId && !matchName) return false
        }
        if (normalizedFeatureQuery) {
          const matchFeature = normalizeForSearch(card.feature || '').includes(normalizedFeatureQuery)
          const matchText = normalizeForSearch(card.text || '').includes(normalizedFeatureQuery)
          if (!matchFeature && !matchText) return false
        }
        return true
      })
      .sort(sortCards)
  }, [cards, selectedSeries, selectedColors, selectedCardTypes, selectedRarities, selectedCosts, selectedAttributes, searchQuery, featureQuery])

  // 選択カードの配列
  const selectedDeck = useMemo(() =>
    Array.from(selectedCards.values()).sort(sortDeckCards)
  , [selectedCards])

  // 合計枚数
  const totalCount = useMemo(() =>
    selectedDeck.reduce((sum, c) => sum + c.count, 0)
  , [selectedDeck])

  const hasActiveFilters = searchQuery || featureQuery || selectedSeries.length > 0 || selectedColors.length > 0 || selectedCardTypes.length > 0 || selectedRarities.length > 0 || selectedCosts.length > 0 || selectedAttributes.length > 0

  const clearFilters = () => {
    setSearchQuery('')
    setFeatureQuery('')
    setSelectedSeries([])
    setSelectedColors([])
    setSelectedCardTypes([])
    setSelectedRarities([])
    setSelectedCosts([])
    setSelectedAttributes([])
  }

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

  const toggleCostFilter = (cost: number) => {
    if (selectedCosts.includes(cost)) {
      setSelectedCosts(selectedCosts.filter(c => c !== cost))
    } else {
      setSelectedCosts([...selectedCosts, cost])
    }
  }

  const toggleAttributeFilter = (attr: string) => {
    if (selectedAttributes.includes(attr)) {
      setSelectedAttributes(selectedAttributes.filter(a => a !== attr))
    } else {
      setSelectedAttributes([...selectedAttributes, attr])
    }
  }

  // カード追加
  const addCard = useCallback((card: Card) => {
    setSelectedCards(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(card.id)
      if (existing) {
        if (existing.count >= MAX_COPIES) return prev
        newMap.set(card.id, { ...existing, count: existing.count + 1 })
      } else {
        newMap.set(card.id, { ...card, count: 1 })
      }
      return newMap
    })
  }, [])

  // カード削除
  const removeCard = useCallback((cardId: string) => {
    setSelectedCards(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(cardId)
      if (existing) {
        if (existing.count <= 1) {
          newMap.delete(cardId)
        } else {
          newMap.set(cardId, { ...existing, count: existing.count - 1 })
        }
      }
      return newMap
    })
  }, [])

  // 全クリア
  const clearAll = useCallback(() => {
    setSelectedCards(new Map())
  }, [])

  // PDF出力（履歴も自動保存）
  const handleExportPDF = async () => {
    if (totalCount === 0) return

    setIsGeneratingPDF(true)
    setPdfProgress(0)
    setPdfLoadedCount(0)
    setPdfTotalCount(totalCount)

    const historyName = formatDateForName()

    try {
      const result = await exportDeckToPDF({
        deck: selectedDeck,
        leader: null,
        apiBase: API_BASE,
        deckName: `proxy_${historyName}`,
        onProgress: (progress, loaded, total) => {
          setPdfProgress(progress)
          setPdfLoadedCount(loaded)
          setPdfTotalCount(total)
        }
      })

      if (result.success) {
        showToastNotification(`PDF出力完了: ${result.filename}`)

        // ログイン中なら履歴を保存
        if (proxyList.isAuthenticated) {
          const cardsToSave: ProxyListCard[] = selectedDeck.map(c => ({
            id: c.id,
            name: c.name,
            image: c.image,
            count: c.count
          }))
          try {
            await proxyList.saveList(historyName, cardsToSave)
            void fetchHistory()
          } catch (err) {
            console.error('Failed to save history:', err)
          }
        }
      } else {
        showToastNotification(`PDF出力に失敗: ${result.error}`)
      }
    } catch (error) {
      console.error('PDF export error:', error)
      showToastNotification('PDF出力中にエラーが発生しました')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  // 履歴から読み込み
  const loadFromHistory = async (name: string) => {
    if (!proxyList.isAuthenticated) return

    try {
      const list = await proxyList.loadList(name)
      if (list) {
        const newMap = new Map<string, DeckCard>()
        list.cards.forEach(c => {
          const fullCard = cards.find(card => card.id === c.id)
          if (fullCard) {
            newMap.set(c.id, { ...fullCard, count: c.count })
          } else {
            newMap.set(c.id, { id: c.id, name: c.name, image: c.image, count: c.count })
          }
        })
        setSelectedCards(newMap)
        showToastNotification(`履歴から読み込みました`)
      }
    } catch (error) {
      console.error('Failed to load from history:', error)
      showToastNotification('読み込みに失敗しました')
    }
  }

  // 履歴を削除
  const deleteHistory = async (name: string) => {
    if (!proxyList.isAuthenticated) return
    if (!confirm('この履歴を削除しますか？')) return

    try {
      await proxyList.deleteList(name)
      showToastNotification('履歴を削除しました')
      void fetchHistory()
    } catch (error) {
      console.error('Failed to delete history:', error)
      showToastNotification('削除に失敗しました')
    }
  }

  // 日付表示フォーマット
  const formatHistoryDate = (name: string) => {
    // 20250531_1430 -> 2025/05/31 14:30
    const match = name.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})$/)
    if (match) {
      return `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}`
    }
    return name
  }

  const proxyStructuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      createBreadcrumbStructuredData([
        { name: 'ホーム', url: '/' },
        { name: 'プロキシ作成', url: '/proxy' },
      ]),
      {
        '@type': 'SoftwareApplication',
        name: 'ワンピースカード プロキシメーカー',
        description: 'ワンピースカードのプロキシカードをPDFで作成。印刷して練習に使えます。',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
      },
    ],
  }

  const pageHead = (
    <SEOHead
      title="ワンピースカード プロキシ作成"
      description="ワンピースカード(OPTCG)のプロキシカードをPDFで作成。カードを選んで印刷用PDFを出力できます。無料で使えるプロキシメーカー。"
      canonicalPath="/proxy"
      keywords="ワンピースカード プロキシ, OPTCG プロキシ, ワンピースカード 印刷, プロキシカード 作成, ONE PIECE カード プロキシ"
      structuredData={proxyStructuredData}
    />
  )

  if (loading) {
    return (
      <div className="proxy-page">
        {pageHead}
        <div className="page-nav-container"><PageNav /></div>
        <header className="proxy-header">
          <h1>プロキシ作成</h1>
        </header>
        <main className="proxy-main">
          <div className="proxy-card-pool">
            <CardGridSkeleton cardCount={isMobile ? 9 : 20} />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="proxy-page">
      {pageHead}
      <div className="page-nav-container"><PageNav /></div>

      <header className="proxy-header">
        <div className="proxy-header-left">
          <h1>プロキシ作成</h1>
        </div>
        <div className="proxy-actions">
          <button
            className="pdf-button"
            onClick={handleExportPDF}
            disabled={totalCount === 0 || isGeneratingPDF}
          >
            PDF出力 ({totalCount}枚)
          </button>
          {!proxyList.isAuthenticated && <LoginButton />}
        </div>
      </header>

      {/* モバイルタブ */}
      {isMobile && (
        <div className="proxy-mobile-tabs">
          <button
            className={activeTab === 'cards' ? 'active' : ''}
            onClick={() => setActiveTab('cards')}
          >
            カード
          </button>
          <button
            className={activeTab === 'list' ? 'active' : ''}
            onClick={() => setActiveTab('list')}
          >
            選択中 ({totalCount})
          </button>
          {proxyList.isAuthenticated && (
            <button
              className={activeTab === 'history' ? 'active' : ''}
              onClick={() => setActiveTab('history')}
            >
              履歴
            </button>
          )}
        </div>
      )}

      <main className="proxy-main">
        {/* 履歴サイドバー（デスクトップのみ） */}
        {!isMobile && proxyList.isAuthenticated && (
          <aside className="proxy-history-panel">
            <div className="history-header">
              <h2>履歴</h2>
            </div>
            <div className="history-list">
              {history.length === 0 ? (
                <p className="no-history">履歴がありません</p>
              ) : (
                <ul>
                  {history.map(item => (
                    <li key={item.name}>
                      <button
                        className="history-item"
                        onClick={() => void loadFromHistory(item.name)}
                      >
                        <span className="history-date">{formatHistoryDate(item.name)}</span>
                        <span className="history-count">{item.cardCount}枚</span>
                      </button>
                      <button
                        className="history-delete"
                        onClick={() => void deleteHistory(item.name)}
                        title="削除"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}

        {/* カードプール */}
        <section className={`proxy-card-pool ${isMobile && activeTab !== 'cards' ? 'hidden' : ''}`}>
          <FilterPanel
            isOpen={isFilterPanelOpen}
            onClose={() => setIsFilterPanelOpen(false)}
            isMobile={isMobile}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            featureQuery={featureQuery}
            onFeatureChange={setFeatureQuery}
            colors={colors}
            selectedColors={selectedColors}
            onColorToggle={(color) => toggleFilter(selectedColors, setSelectedColors, color)}
            cardTypes={cardTypes}
            selectedCardTypes={selectedCardTypes}
            onTypeToggle={(type) => toggleFilter(selectedCardTypes, setSelectedCardTypes, type)}
            rarities={rarities}
            selectedRarities={selectedRarities}
            onRarityToggle={(rarity) => toggleFilter(selectedRarities, setSelectedRarities, rarity)}
            costs={costs}
            selectedCosts={selectedCosts}
            onCostToggle={toggleCostFilter}
            attributes={attributes}
            selectedAttributes={selectedAttributes}
            onAttributeToggle={toggleAttributeFilter}
            series={series}
            selectedSeries={selectedSeries}
            onSeriesAdd={(id) => setSelectedSeries([...selectedSeries, id])}
            onSeriesRemove={(id) => setSelectedSeries(selectedSeries.filter(s => s !== id))}
            onClearFilters={clearFilters}
            hasActiveFilters={!!hasActiveFilters}
          />
          {isMobile && (
            <button className="filter-toggle-button" onClick={() => setIsFilterPanelOpen(true)}>
              フィルター {hasActiveFilters ? '(有効)' : ''}
            </button>
          )}
          <div className="proxy-grid-container">
            <VirtualCardGrid
              cards={filteredCards}
              isMobile={isMobile}
              enableHoverZoom={false}
              maxCopies={MAX_COPIES}
              getCardCount={(id) => selectedCards.get(id)?.count || 0}
              onAddToDeck={addCard}
              onRemoveFromDeck={removeCard}
              onHoverCard={() => {}}
            />
          </div>
        </section>

        {/* 選択リスト */}
        <aside className={`proxy-list-panel ${isMobile && activeTab !== 'list' ? 'hidden' : ''}`}>
          <div className="list-header">
            <h2>選択カード ({totalCount}枚)</h2>
            <button onClick={clearAll} disabled={totalCount === 0}>クリア</button>
          </div>
          <VirtualDeckList
            cards={selectedDeck}
            maxCopies={MAX_COPIES}
            onAddCard={addCard}
            onRemoveCard={removeCard}
          />
        </aside>

        {/* 履歴パネル（モバイルのみ） */}
        {isMobile && proxyList.isAuthenticated && (
          <aside className={`proxy-history-panel mobile ${activeTab !== 'history' ? 'hidden' : ''}`}>
            <div className="history-header">
              <h2>履歴</h2>
            </div>
            <div className="history-list">
              {history.length === 0 ? (
                <p className="no-history">履歴がありません</p>
              ) : (
                <ul>
                  {history.map(item => (
                    <li key={item.name}>
                      <button
                        className="history-item"
                        onClick={() => {
                          void loadFromHistory(item.name)
                          setActiveTab('list')
                        }}
                      >
                        <span className="history-date">{formatHistoryDate(item.name)}</span>
                        <span className="history-count">{item.cardCount}枚</span>
                      </button>
                      <button
                        className="history-delete"
                        onClick={() => void deleteHistory(item.name)}
                        title="削除"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
      </main>

      {/* PDF生成中モーダル */}
      {isGeneratingPDF && (
        <div className="pdf-progress-modal">
          <div className="pdf-progress-content">
            <h3>PDF生成中...</h3>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pdfProgress}%` }} />
            </div>
            <p>{pdfLoadedCount} / {pdfTotalCount} 枚</p>
          </div>
        </div>
      )}

      {/* トースト */}
      {showToast && (
        <Toast
          key={toastKey}
          message={toastMessage}
          isVisible={showToast}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  )
}
