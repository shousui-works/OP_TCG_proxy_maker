import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import './App.css'
import { exportDeckToPDF } from './utils/pdfExport'
import { exportDeckToImage } from './utils/deckImageExport'
import { normalizeForSearch } from './utils/textNormalize'
import { useAuth } from './contexts/AuthContext'
import { useFirestoreDeck } from './hooks/useFirestoreDeck'
import { useResponsive } from './hooks/useResponsive'
import LoginButton from './components/LoginButton'
import MobileHeader from './components/MobileHeader'
import HamburgerMenu from './components/HamburgerMenu'
import BottomNavigation, { type TabType } from './components/BottomNavigation'
import FilterPanel from './components/FilterPanel'
import VirtualCardGrid from './components/VirtualCardGrid'
import DeckImportExportModal from './components/DeckImportExportModal'
import CardGridSkeleton from './components/CardGridSkeleton'
import Toast from './components/Toast'

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
}

interface DeckCard extends Card {
  count: number
}

interface SavedDeck {
  name: string
  deck_count: number
  updated_at: string
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const MAX_DECK_SIZE = 50
const MAX_COPIES = 4

function App() {
  const { user } = useAuth()
  const firestore = useFirestoreDeck()
  const { isMobile } = useResponsive()

  const [cards, setCards] = useState<Card[]>([])
  const [deck, setDeck] = useState<DeckCard[]>([])
  const [leader, setLeader] = useState<Card | null>(null)
  const [loading, setLoading] = useState(true)

  // デッキ保存関連の状態
  const [currentDeckName, setCurrentDeckName] = useState<string | null>(null)
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([])
  const [showSaveAsModal, setShowSaveAsModal] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // ホバープレビュー状態（PC版）
  const [hoverCard, setHoverCard] = useState<{ card: Card; x: number; y: number } | null>(null)
  const [enableHoverZoom, setEnableHoverZoom] = useState(false)

  // PDF生成状態
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [pdfSelectedCards, setPdfSelectedCards] = useState<Map<string, number>>(new Map())
  const [pdfIncludeLeader, setPdfIncludeLeader] = useState(true)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [pdfProgress, setPdfProgress] = useState(0)
  const [pdfLoadedCount, setPdfLoadedCount] = useState(0)
  const [pdfTotalCount, setPdfTotalCount] = useState(0)

  // 画像出力状態
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [imageProgress, setImageProgress] = useState(0)
  const [showImageModal, setShowImageModal] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [generatedImageFilename, setGeneratedImageFilename] = useState<string | null>(null)

  // Import/Export状態
  const [showImportExportModal, setShowImportExportModal] = useState(false)
  const [importExportMode, setImportExportMode] = useState<'import' | 'export'>('export')


  // トースト通知
  const [toastMessage, setToastMessage] = useState('')
  const [showToast, setShowToast] = useState(false)
  const [toastKey, setToastKey] = useState(0)

  // バージョン名入力モーダル
  const [showVersionNameModal, setShowVersionNameModal] = useState(false)
  const [versionName, setVersionName] = useState('')
  const [pendingSaveType, setPendingSaveType] = useState<'save' | 'saveAs' | null>(null)

  const showToastNotification = useCallback((message: string) => {
    setToastMessage(message)
    setToastKey(prev => prev + 1)
    setShowToast(true)
  }, [])

  // フィルター・検索
  const [series, setSeries] = useState<Series[]>([])
  const [selectedSeries, setSelectedSeries] = useState<string[]>([])
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedCardTypes, setSelectedCardTypes] = useState<string[]>([])
  const [selectedRarities, setSelectedRarities] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // モバイルUI状態
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('cards')

  // デスクトップサイドバー用バージョン展開状態
  const [expandedDecks, setExpandedDecks] = useState<Set<string>>(new Set())
  const [sidebarVersions, setSidebarVersions] = useState<Record<string, import('./hooks/useFirestoreDeck').DeckVersionInfo[]>>({})
  const [loadingVersions, setLoadingVersions] = useState<Set<string>>(new Set())

  const colors = ['赤', '緑', '青', '紫', '黒', '黄']
  const cardTypes = ['LEADER', 'CHARACTER', 'EVENT', 'STAGE']
  const rarities = ['L', 'C', 'UC', 'R', 'SR', 'SEC', 'SP']

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

  // 保存済みデッキ一覧を取得
  const fetchSavedDecks = useCallback(async () => {
    try {
      if (user && firestore.isAuthenticated) {
        const data = await firestore.fetchBranches()
        setSavedDecks(data.branches.map(b => ({
          name: b.name,
          deck_count: b.deck_count,
          updated_at: b.updated_at
        })))
      } else {
        const res = await fetch(`${API_BASE}/api/branches`)
        if (!res.ok) {
          throw new Error(`HTTP error: ${res.status}`)
        }
        const data = await res.json()
        setSavedDecks(data.branches.map((b: SavedDeck) => ({
          name: b.name,
          deck_count: b.deck_count,
          updated_at: b.updated_at
        })))
      }
    } catch (err) {
      console.error('Failed to fetch saved decks:', err)
    }
  }, [user, firestore])

  // デッキを読み込む
  const loadDeck = useCallback(async (deckName: string) => {
    if (hasUnsavedChanges) {
      if (!confirm('未保存の変更があります。破棄してデッキを読み込みますか？')) {
        return
      }
    }

    try {
      if (user && firestore.isAuthenticated) {
        const data = await firestore.getDeck(deckName)
        setDeck(data.deck || [])
        setLeader(data.leader || null)
      } else {
        const res = await fetch(`${API_BASE}/api/deck/${deckName}`)
        if (!res.ok) {
          throw new Error(`HTTP error: ${res.status}`)
        }
        const data = await res.json()
        setDeck(data.deck || [])
        setLeader(data.leader || null)
      }
      setCurrentDeckName(deckName)
      setHasUnsavedChanges(false)
    } catch (err) {
      console.error('Failed to load deck:', err)
    }
  }, [user, firestore, hasUnsavedChanges])

  // 初期化（カードデータ・シリーズはAPIから取得）
  // 統合API（include_details=true）で1回のリクエストで全データを取得
  useEffect(() => {
    const initCards = async () => {
      try {
        const [cardsRes, seriesRes] = await Promise.all([
          fetch(`${API_BASE}/api/cards?include_details=true`),
          fetch(`${API_BASE}/api/series`)
        ])
        if (!cardsRes.ok) {
          throw new Error(`Failed to fetch cards: ${cardsRes.status}`)
        }
        if (!seriesRes.ok) {
          throw new Error(`Failed to fetch series: ${seriesRes.status}`)
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
    initCards()
  }, [])

  // 保存済みデッキを初期化
  useEffect(() => {
    void fetchSavedDecks()
  }, [fetchSavedDecks])

  // フィルター済みカード（useMemoで最適化）
  const filteredCards = useMemo(() => {
    // 検索クエリの正規化はループ外で1回だけ実行
    const normalizedQuery = searchQuery ? normalizeForSearch(searchQuery) : ''

    return cards.filter(card => {
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
      if (normalizedQuery) {
        const matchId = normalizeForSearch(card.id).includes(normalizedQuery)
        const matchName = normalizeForSearch(card.name || '').includes(normalizedQuery)

        if (!matchId && !matchName) return false
      }
      return true
    })
  }, [cards, selectedSeries, selectedColors, selectedCardTypes, selectedRarities, searchQuery])

  // deckをMapに変換してO(1)検索
  const deckMap = useMemo(() => {
    return new Map(deck.map(c => [c.id, c.count]))
  }, [deck])

  const hasActiveFilters = searchQuery || selectedSeries.length > 0 || selectedColors.length > 0 || selectedCardTypes.length > 0 || selectedRarities.length > 0

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedSeries([])
    setSelectedColors([])
    setSelectedCardTypes([])
    setSelectedRarities([])
  }

  // デッキを保存（上書き）- バージョン名入力モーダルを表示
  const saveDeck = async () => {
    if (!currentDeckName) {
      setShowSaveAsModal(true)
      return
    }

    // Firebaseの場合はバージョン名入力モーダルを表示
    if (user && firestore.isAuthenticated) {
      setPendingSaveType('save')
      setVersionName('')
      setShowVersionNameModal(true)
      return
    }

    // ローカルの場合は直接保存
    await executeSave(currentDeckName)
  }

  // 実際の保存処理
  const executeSave = async (deckName: string, versionNameInput?: string) => {
    try {
      if (user && firestore.isAuthenticated) {
        await firestore.saveDeck(deckName, deck, leader, {
          versionName: versionNameInput || undefined
        })
        // バージョン一覧を更新
        const versions = await firestore.fetchVersions(deckName)
        setSidebarVersions(prev => ({ ...prev, [deckName]: versions }))
      } else {
        const saveRes = await fetch(`${API_BASE}/api/deck/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch: deckName, deck, leader })
        })
        if (!saveRes.ok) {
          throw new Error(`Failed to save deck: ${saveRes.status}`)
        }
      }
      setHasUnsavedChanges(false)
      fetchSavedDecks()
      showToastNotification('保存しました')
    } catch (err) {
      console.error('Failed to save deck:', err)
      showToastNotification('保存に失敗しました')
    }
  }

  // 名前をつけて保存
  const saveAsNewDeck = async () => {
    if (!newDeckName.trim()) return

    // Firebaseの場合はバージョン名入力モーダルを表示
    if (user && firestore.isAuthenticated) {
      setShowSaveAsModal(false)
      setPendingSaveType('saveAs')
      setVersionName('')
      setShowVersionNameModal(true)
      return
    }

    // ローカルの場合は直接保存
    await executeNewDeckSave(newDeckName)
  }

  // 新規デッキの実際の保存処理
  const executeNewDeckSave = async (deckName: string, versionNameInput?: string) => {
    try {
      if (user && firestore.isAuthenticated) {
        await firestore.createBranch(deckName, null)
        await firestore.saveDeck(deckName, deck, leader, {
          versionName: versionNameInput || undefined
        })
        // バージョン一覧を更新
        const versions = await firestore.fetchVersions(deckName)
        setSidebarVersions(prev => ({ ...prev, [deckName]: versions }))
      } else {
        const createRes = await fetch(`${API_BASE}/api/branches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: deckName, from_branch: null })
        })
        if (!createRes.ok) {
          throw new Error(`Failed to create branch: ${createRes.status}`)
        }
        const saveRes = await fetch(`${API_BASE}/api/deck/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch: deckName, deck, leader })
        })
        if (!saveRes.ok) {
          throw new Error(`Failed to save deck: ${saveRes.status}`)
        }
      }
      setCurrentDeckName(deckName)
      setNewDeckName('')
      setShowSaveAsModal(false)
      setHasUnsavedChanges(false)
      fetchSavedDecks()
      showToastNotification('保存しました')
    } catch (err) {
      console.error('Failed to save deck:', err)
      showToastNotification('保存に失敗しました')
    }
  }

  // デッキを削除
  const deleteDeck = async (deckName: string) => {
    if (!confirm(`デッキ "${deckName}" を削除しますか？`)) return

    try {
      if (user && firestore.isAuthenticated) {
        await firestore.deleteBranch(deckName)
      } else {
        await fetch(`${API_BASE}/api/branches/${deckName}`, {
          method: 'DELETE'
        })
      }
      fetchSavedDecks()
      if (currentDeckName === deckName) {
        setCurrentDeckName(null)
        setDeck([])
        setLeader(null)
        setHasUnsavedChanges(false)
      }
    } catch (err) {
      console.error('Failed to delete deck:', err)
    }
  }

  // リーダーを設定
  const setLeaderCard = (card: Card) => {
    if (card.card_type !== 'LEADER') return
    setLeader(card)
    setHasUnsavedChanges(true)

    if (card.color) {
      const leaderColors = colors.filter(c => card.color?.includes(c))
      if (leaderColors.length > 0) {
        setSelectedColors(leaderColors)
      }
    }
  }

  const removeLeader = () => {
    setLeader(null)
    setHasUnsavedChanges(true)
  }

  const addToDeck = (card: Card) => {
    if (card.card_type === 'LEADER') {
      setLeaderCard(card)
      return
    }

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

  const newDeck = () => {
    if (hasUnsavedChanges) {
      if (!confirm('未保存の変更があります。新しいデッキを作成しますか？')) {
        return
      }
    }
    setDeck([])
    setLeader(null)
    setCurrentDeckName(null)
    setHasUnsavedChanges(false)
  }

  // PDF出力モーダルを開く
  const openPdfModal = () => {
    if (deck.length === 0 && !leader) return
    // 初期状態は0枚
    setPdfSelectedCards(new Map<string, number>())
    setPdfIncludeLeader(false)
    setShowPdfModal(true)
  }

  // 全選択
  const selectAllPdfCards = () => {
    const allSelection = new Map<string, number>()
    deck.forEach(card => {
      allSelection.set(card.id, card.count)
    })
    setPdfSelectedCards(allSelection)
    setPdfIncludeLeader(!!leader)
  }

  // 全解除
  const deselectAllPdfCards = () => {
    setPdfSelectedCards(new Map<string, number>())
    setPdfIncludeLeader(false)
  }

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

  const pdfTotalCards = Array.from(pdfSelectedCards.values()).reduce((sum, count) => sum + count, 0) + (pdfIncludeLeader && leader ? 1 : 0)

  const handleExportPDF = async () => {
    setShowPdfModal(false)
    setIsGeneratingPDF(true)
    setPdfProgress(0)
    setPdfLoadedCount(0)
    setPdfTotalCount(0)

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
      deckName: currentDeckName,
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

  // デッキ画像出力
  const handleExportImage = async () => {
    if (deck.length === 0 && !leader) return

    setIsGeneratingImage(true)
    setImageProgress(0)

    const result = await exportDeckToImage({
      deck,
      leader,
      apiBase: API_BASE,
      deckName: currentDeckName,
      onProgress: (progress) => {
        setImageProgress(progress)
      }
    })

    setIsGeneratingImage(false)

    if (!result.success) {
      alert(`画像生成に失敗しました: ${result.error}`)
    } else if (result.imageDataUrl) {
      setGeneratedImageUrl(result.imageDataUrl)
      setGeneratedImageFilename(result.filename || 'deck_image.png')
      setShowImageModal(true)
    }
  }

  // 画像をダウンロード
  const downloadImage = () => {
    if (!generatedImageUrl) return
    const link = document.createElement('a')
    link.download = generatedImageFilename || 'deck_image.png'
    link.href = generatedImageUrl
    link.click()
  }

  // 画像をクリップボードにコピー
  const copyImageToClipboard = async () => {
    if (!generatedImageUrl) return
    try {
      const response = await fetch(generatedImageUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
      alert('画像をクリップボードにコピーしました')
    } catch {
      alert('クリップボードへのコピーに失敗しました')
    }
  }

  // Import/Export
  const openExportModal = () => {
    setImportExportMode('export')
    setShowImportExportModal(true)
  }

  const openImportModal = () => {
    setImportExportMode('import')
    setShowImportExportModal(true)
  }

  const handleImportDeck = (importedDeck: DeckCard[], importedLeader: Card | null): boolean => {
    if (hasUnsavedChanges) {
      if (!confirm('未保存の変更があります。インポートしたデッキで置き換えますか？')) {
        return false // Cancel - don't close modal
      }
    }
    setDeck(importedDeck)
    setLeader(importedLeader)
    setCurrentDeckName(null)
    setHasUnsavedChanges(true)
    return true // Success - close modal
  }

  // バージョン読込ハンドラー
  const handleLoadVersion = async (branchName: string, versionId: string) => {
    if (hasUnsavedChanges) {
      if (!confirm('未保存の変更があります。破棄してバージョンを読み込みますか？')) {
        return
      }
    }

    try {
      const { deck: restoredDeck, leader: restoredLeader } = await firestore.restoreVersion(
        branchName,
        versionId
      )
      // Card型に変換
      const convertedDeck: DeckCard[] = restoredDeck.map((card) => ({
        ...card,
        count: card.count,
      }))
      const convertedLeader: Card | null = restoredLeader
        ? {
            id: restoredLeader.id,
            name: restoredLeader.name,
            image: restoredLeader.image,
            color: restoredLeader.color,
          }
        : null
      setDeck(convertedDeck)
      setLeader(convertedLeader)
      setCurrentDeckName(branchName)
      setHasUnsavedChanges(true)
    } catch (error) {
      console.error('Failed to load version:', error)
    }
  }

  const getCardCount = (cardId: string) => {
    return deckMap.get(cardId) || 0
  }

  // サイドバー用バージョン展開トグル
  const toggleSidebarExpanded = async (deckName: string) => {
    const newExpanded = new Set(expandedDecks)

    if (newExpanded.has(deckName)) {
      newExpanded.delete(deckName)
      setExpandedDecks(newExpanded)
    } else {
      newExpanded.add(deckName)
      setExpandedDecks(newExpanded)

      // Fetch versions if not already loaded
      if (!sidebarVersions[deckName] && user) {
        setLoadingVersions(prev => new Set(prev).add(deckName))
        try {
          const versions = await firestore.fetchVersions(deckName)
          setSidebarVersions(prev => ({ ...prev, [deckName]: versions }))
        } catch (error) {
          console.error('Failed to fetch versions:', error)
        } finally {
          setLoadingVersions(prev => {
            const next = new Set(prev)
            next.delete(deckName)
            return next
          })
        }
      }
    }
  }

  // バージョン名を確定して保存
  const confirmVersionSave = async () => {
    setShowVersionNameModal(false)
    const trimmedVersionName = versionName.trim()

    if (pendingSaveType === 'save' && currentDeckName) {
      await executeSave(currentDeckName, trimmedVersionName || undefined)
    } else if (pendingSaveType === 'saveAs' && newDeckName.trim()) {
      await executeNewDeckSave(newDeckName.trim(), trimmedVersionName || undefined)
    }

    setPendingSaveType(null)
    setVersionName('')
  }

  // バージョン名入力をキャンセル
  const cancelVersionSave = () => {
    setShowVersionNameModal(false)
    setPendingSaveType(null)
    setVersionName('')
  }

  const deckPageHead = (
    <Helmet>
      <title>ワンピースカード プロキシ作成・デッキ構築 | OP-TCG base</title>
      <meta name="description" content="ワンピースカードのプロキシ作成ツール。カードを選んでデッキを構築し、プロキシカードをPDF/画像で出力。印刷して練習に使えます。" />
      <meta name="keywords" content="ワンピースカード, プロキシ, ONE PIECE, カードゲーム, デッキビルダー, プロキシカード, プロキシメーカー, OPTCG" />
      <link rel="canonical" href="https://op-tcg-base.ludora-base.com/deck" />
    </Helmet>
  )

  if (loading) {
    return (
      <div className={`app ${isMobile ? 'is-mobile' : ''}`}>
        {deckPageHead}
        {isMobile ? (
          <MobileHeader
            onMenuToggle={() => {}}
            currentDeckName={null}
            hasUnsavedChanges={false}
          />
        ) : (
          <header className="header">
            <div className="header-left">
              <h1>OP-TCG base</h1>
            </div>
            <div className="deck-controls">
              <span className="loading-text">読み込み中...</span>
            </div>
            <LoginButton />
          </header>
        )}
        <main className="main-content">
          <div className="card-list-panel">
            <CardGridSkeleton cardCount={isMobile ? 9 : 20} />
          </div>
        </main>
        {isMobile && (
          <BottomNavigation
            activeTab="cards"
            onTabChange={() => {}}
            deckCount={0}
            maxDeckSize={MAX_DECK_SIZE}
            hasActiveFilters={false}
            onFilterToggle={() => {}}
          />
        )}
      </div>
    )
  }

  return (
    <div className={`app ${isMobile ? 'is-mobile' : ''}`}>
      {deckPageHead}
      {/* モバイルヘッダー */}
      {isMobile ? (
        <MobileHeader
          onMenuToggle={() => setIsMobileMenuOpen(true)}
          currentDeckName={currentDeckName}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      ) : (
        <header className="header">
          <div className="header-left">
            <Link to="/" className="home-link">
              <h1>OP-TCG base</h1>
            </Link>
            <nav className="header-nav">
              <Link to="/tournaments" className="nav-link">大会管理</Link>
            </nav>
          </div>
          <div className="deck-controls">
            <div className="current-deck">
              <span>{currentDeckName || '(新規デッキ)'}</span>
              {hasUnsavedChanges && <span className="unsaved-indicator">*</span>}
            </div>
            <button onClick={newDeck}>
              新規
            </button>
            <button onClick={saveDeck} disabled={!hasUnsavedChanges && !!currentDeckName}>
              保存
            </button>
            <button onClick={() => setShowSaveAsModal(true)}>
              名前をつけて保存
            </button>
          </div>
          <LoginButton />
        </header>
      )}

      {/* ハンバーガーメニュー (モバイル) */}
      <HamburgerMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        savedDecks={savedDecks}
        currentDeckName={currentDeckName}
        hasUnsavedChanges={hasUnsavedChanges}
        onLoadDeck={loadDeck}
        onNewDeck={newDeck}
        onSave={saveDeck}
        onSaveAs={() => setShowSaveAsModal(true)}
        onDeleteDeck={deleteDeck}
        onLoadVersion={handleLoadVersion}
        fetchVersions={user ? firestore.fetchVersions : undefined}
        onDeleteVersion={user ? async (branchName: string, versionId: string) => {
          try {
            await firestore.deleteVersion(branchName, versionId)
            showToastNotification('バージョンを削除しました')
          } catch (error) {
            showToastNotification('削除に失敗しました')
            throw error
          }
        } : undefined}
      />

      {/* フィルターパネル */}
      <FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        isMobile={isMobile}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        colors={colors}
        selectedColors={selectedColors}
        onColorToggle={(c) => toggleFilter(selectedColors, setSelectedColors, c)}
        cardTypes={cardTypes}
        selectedCardTypes={selectedCardTypes}
        onTypeToggle={(t) => toggleFilter(selectedCardTypes, setSelectedCardTypes, t)}
        rarities={rarities}
        selectedRarities={selectedRarities}
        onRarityToggle={(r) => toggleFilter(selectedRarities, setSelectedRarities, r)}
        series={series}
        selectedSeries={selectedSeries}
        onSeriesAdd={(id) => setSelectedSeries(prev => [...prev, id])}
        onSeriesRemove={(id) => setSelectedSeries(prev => prev.filter(s => s !== id))}
        onClearFilters={clearFilters}
        hasActiveFilters={!!hasActiveFilters}
      />

      {/* 保存済みデッキ一覧サイドバー (デスクトップ) */}
      {!isMobile && (
        <div className="deck-sidebar">
          <h3>保存済みデッキ</h3>
          {savedDecks.length === 0 ? (
            <p className="no-decks">保存済みデッキはありません</p>
          ) : (
            <ul className="saved-deck-list">
              {savedDecks.map(savedDeck => {
                const isExpanded = expandedDecks.has(savedDeck.name)
                const versions = sidebarVersions[savedDeck.name] || []
                const isLoading = loadingVersions.has(savedDeck.name)

                return (
                  <li
                    key={savedDeck.name}
                    className={`saved-deck-item ${savedDeck.name === currentDeckName ? 'active' : ''}`}
                  >
                    <div className="saved-deck-row">
                      {user && (
                        <button
                          className="expand-btn"
                          onClick={() => toggleSidebarExpanded(savedDeck.name)}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="saved-deck-info"
                        onClick={() => loadDeck(savedDeck.name)}
                      >
                        <span className="saved-deck-name">{savedDeck.name}</span>
                        <span className="saved-deck-count">{savedDeck.deck_count}枚</span>
                      </button>
                      <button
                        className="saved-deck-delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteDeck(savedDeck.name)
                        }}
                      >
                        ×
                      </button>
                    </div>

                    {isExpanded && user && (
                      <div className="version-list">
                        {isLoading ? (
                          <div className="version-loading">読込中...</div>
                        ) : versions.length === 0 ? (
                          <div className="version-empty">バージョンなし</div>
                        ) : (
                          versions.slice(0, 10).map((version, index) => (
                            <div
                              key={version.id}
                              className={`version-item ${index === 0 ? 'latest' : ''}`}
                            >
                              <button
                                className="version-name"
                                onClick={() => handleLoadVersion(savedDeck.name, version.id)}
                              >
                                {version.name || `v${version.versionNumber}`}
                              </button>
                              <button
                                className="version-delete-btn"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (!confirm('このバージョンを削除しますか？')) return
                                  try {
                                    await firestore.deleteVersion(savedDeck.name, version.id)
                                    // バージョン一覧を更新
                                    const updatedVersions = await firestore.fetchVersions(savedDeck.name)
                                    setSidebarVersions(prev => ({ ...prev, [savedDeck.name]: updatedVersions }))
                                    showToastNotification('バージョンを削除しました')
                                  } catch (error) {
                                    console.error('Failed to delete version:', error)
                                    showToastNotification('削除に失敗しました')
                                  }
                                }}
                                aria-label="バージョンを削除"
                              >
                                ×
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <div className="main-content">
        {/* カードプール */}
        <section className={`card-pool ${!isMobile || activeTab === 'cards' ? 'active' : ''}`}>
          <div className="card-pool-header">
            <h2>カードプール ({filteredCards.length}/{cards.length}枚)</h2>
            {/* デスクトップ: インラインフィルター */}
            {!isMobile && (
              <div className="card-pool-controls">
                <label className="hover-zoom-toggle">
                  <input
                    type="checkbox"
                    checked={enableHoverZoom}
                    onChange={(e) => setEnableHoverZoom(e.target.checked)}
                  />
                  拡大表示
                </label>
                <button
                  className="filter-toggle-btn"
                  onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                >
                  フィルター {hasActiveFilters && `(${selectedColors.length + selectedCardTypes.length + selectedRarities.length + selectedSeries.length})`}
                </button>
              </div>
            )}
          </div>

          {/* デスクトップ: フィルターパネル表示 */}
          {!isMobile && isFilterPanelOpen && (
            <FilterPanel
              isOpen={true}
              onClose={() => setIsFilterPanelOpen(false)}
              isMobile={false}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              colors={colors}
              selectedColors={selectedColors}
              onColorToggle={(c) => toggleFilter(selectedColors, setSelectedColors, c)}
              cardTypes={cardTypes}
              selectedCardTypes={selectedCardTypes}
              onTypeToggle={(t) => toggleFilter(selectedCardTypes, setSelectedCardTypes, t)}
              rarities={rarities}
              selectedRarities={selectedRarities}
              onRarityToggle={(r) => toggleFilter(selectedRarities, setSelectedRarities, r)}
              series={series}
              selectedSeries={selectedSeries}
              onSeriesAdd={(id) => setSelectedSeries(prev => [...prev, id])}
              onSeriesRemove={(id) => setSelectedSeries(prev => prev.filter(s => s !== id))}
              onClearFilters={clearFilters}
              hasActiveFilters={!!hasActiveFilters}
            />
          )}

          <VirtualCardGrid
            cards={filteredCards}
            apiBase={API_BASE}
            isMobile={isMobile}
            enableHoverZoom={enableHoverZoom}
            maxCopies={MAX_COPIES}
            getCardCount={getCardCount}
            onAddToDeck={addToDeck}
            onRemoveFromDeck={removeFromDeck}
            onHoverCard={(card, x, y) => {
              if (card) {
                setHoverCard({ card, x, y })
              } else {
                setHoverCard(null)
              }
            }}
          />
        </section>

        {/* デッキパネル */}
        <aside className={`deck-panel ${!isMobile || activeTab === 'deck' ? 'active' : ''}`}>
          <div className="deck-header">
            <h2>デッキ ({deckCount}/{MAX_DECK_SIZE})</h2>
            <div className="deck-actions">
              <button
                onClick={openImportModal}
                className="icon-button"
                data-tooltip="デッキをインポート"
                aria-label="デッキをインポート"
                title="デッキをインポート"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              <button
                onClick={openExportModal}
                disabled={deck.length === 0 && !leader}
                className="icon-button"
                data-tooltip="デッキをエクスポート"
                aria-label="デッキをエクスポート"
                title="デッキをエクスポート"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </button>
              <button
                onClick={openPdfModal}
                disabled={deck.length === 0 && !leader}
                className="icon-button"
                data-tooltip="プロキシPDF生成"
                aria-label="プロキシPDF生成"
                title="プロキシPDF生成"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </button>
              <button
                onClick={handleExportImage}
                disabled={deck.length === 0 && !leader}
                className="icon-button"
                data-tooltip="デッキ画像生成"
                aria-label="デッキ画像生成"
                title="デッキ画像生成"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
              <button
                onClick={clearDeck}
                disabled={deck.length === 0 && !leader}
                className="icon-button icon-button-danger"
                data-tooltip="デッキをクリア"
                aria-label="デッキをクリア"
                title="デッキをクリア"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>

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
                      disabled={card.count >= MAX_COPIES}
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

      {/* ボトムナビゲーション (モバイル) */}
      {isMobile && (
        <BottomNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          deckCount={deckCount}
          maxDeckSize={MAX_DECK_SIZE}
          hasActiveFilters={!!hasActiveFilters}
          onFilterToggle={() => setIsFilterPanelOpen(true)}
        />
      )}

      {/* 名前をつけて保存モーダル */}
      {showSaveAsModal && (
        <div className="modal-overlay" onClick={() => setShowSaveAsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>名前をつけて保存</h3>
            <p className="modal-desc">
              デッキの名前を入力してください
            </p>
            <input
              type="text"
              value={newDeckName}
              onChange={e => setNewDeckName(e.target.value)}
              placeholder="デッキ名"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  saveAsNewDeck()
                }
              }}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={() => setShowSaveAsModal(false)}>キャンセル</button>
              <button onClick={saveAsNewDeck} className="primary" disabled={!newDeckName.trim()}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* バージョン名入力モーダル */}
      {showVersionNameModal && (
        <div className="modal-overlay" onClick={cancelVersionSave}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>バージョン名（任意）</h3>
            <p className="modal-desc">
              このバージョンに名前をつけられます（空欄可）
            </p>
            <input
              type="text"
              value={versionName}
              onChange={e => setVersionName(e.target.value)}
              placeholder="例: 大会用、v1.0"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  confirmVersionSave()
                }
              }}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={cancelVersionSave}>キャンセル</button>
              <button onClick={confirmVersionSave} className="primary">
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* プロキシ作成モーダル */}
      {showPdfModal && (
        <div className="modal-overlay" onClick={() => setShowPdfModal(false)}>
          <div className="modal pdf-select-modal" onClick={e => e.stopPropagation()}>
            <h3>プロキシ作成</h3>
            <p className="modal-desc">
              作成するカードと枚数を選択してください（合計: {pdfTotalCards}枚）
            </p>

            <div className="pdf-select-actions">
              <button onClick={selectAllPdfCards} className="secondary">
                全て選択
              </button>
              <button onClick={deselectAllPdfCards} className="secondary">
                全て解除
              </button>
            </div>

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
                作成 ({pdfTotalCards}枚)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ホバープレビュー（PC版） */}
      {hoverCard && !isMobile && enableHoverZoom && (
        <div
          className="card-preview"
          style={{
            position: 'fixed',
            left: Math.min(hoverCard.x, window.innerWidth - 320),
            top: Math.max(10, Math.min(hoverCard.y, window.innerHeight - 450)),
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <img
            src={`${API_BASE}${hoverCard.card.image}`}
            alt={hoverCard.card.name}
            style={{
              width: '300px',
              borderRadius: '8px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
            }}
          />
        </div>
      )}

      {/* プロキシ生成中モーダル */}
      {isGeneratingPDF && (
        <div className="modal-overlay">
          <div className="modal pdf-modal">
            <h3>プロキシ作成中...</h3>
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

      {/* 画像生成中モーダル */}
      {isGeneratingImage && (
        <div className="modal-overlay">
          <div className="modal pdf-modal">
            <h3>デッキ画像作成中...</h3>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${imageProgress}%` }}
              />
            </div>
            <p className="progress-text">
              {imageProgress}% - 画像読込中
            </p>
          </div>
        </div>
      )}

      {/* 生成画像プレビューモーダル */}
      {showImageModal && generatedImageUrl && (
        <div className="modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="modal image-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="image-preview-header">
              <h3>デッキ画像</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowImageModal(false)}
              >
                ×
              </button>
            </div>
            <div className="image-preview-content">
              <img
                src={generatedImageUrl}
                alt="デッキ画像"
                className="preview-image"
              />
            </div>
            <div className="image-preview-actions">
              <button onClick={copyImageToClipboard} className="secondary">
                コピー
              </button>
              <button onClick={downloadImage} className="primary">
                ダウンロード
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import/Exportモーダル */}
      <DeckImportExportModal
        isOpen={showImportExportModal}
        onClose={() => setShowImportExportModal(false)}
        mode={importExportMode}
        deck={deck}
        leader={leader}
        deckName={currentDeckName}
        availableCards={cards}
        onImport={handleImportDeck}
      />

      {/* トースト通知 */}
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

export default App
