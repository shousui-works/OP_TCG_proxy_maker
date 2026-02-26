import { useState, useEffect } from 'react'
import './Admin.css'

interface Series {
  id: string
  name: string
  url: string
}

interface CrawlStatus {
  is_running: boolean
  status: 'idle' | 'running' | 'completed' | 'error'
  series_id: string
  series_name: string
  progress: number
  total: number
  new_cards: number
  skipped: number
  downloaded: number
  message: string
  errors: string[]
}

interface CardsData {
  total_cards: number
  crawled_at: string | null
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function Admin() {
  const [series, setSeries] = useState<Series[]>([])
  const [seriesLastUpdated, setSeriesLastUpdated] = useState<string | null>(null)
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('')
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus | null>(null)
  const [cardCount, setCardCount] = useState(0)
  const [cardsData, setCardsData] = useState<CardsData | null>(null)

  // シリーズ一覧を取得
  useEffect(() => {
    fetch(`${API_BASE}/api/series`)
      .then(res => res.json())
      .then(data => {
        setSeries(data.series || [])
        setSeriesLastUpdated(data.last_updated)
        if (data.series?.length > 0 && !selectedSeriesId) {
          setSelectedSeriesId(data.series[0].id)
        }
      })
      .catch(err => console.error('Failed to fetch series:', err))
  }, [])

  // カード画像数を取得
  useEffect(() => {
    fetch(`${API_BASE}/api/cards`)
      .then(res => res.json())
      .then(data => setCardCount(data.cards?.length || 0))
      .catch(err => console.error('Failed to fetch cards:', err))
  }, [crawlStatus?.status])

  // カードデータを取得
  useEffect(() => {
    fetch(`${API_BASE}/api/cards/data`)
      .then(res => res.json())
      .then(data => setCardsData(data))
      .catch(err => console.error('Failed to fetch cards data:', err))
  }, [crawlStatus?.status])

  // クローリング状態をポーリング
  useEffect(() => {
    const fetchStatus = () => {
      fetch(`${API_BASE}/api/crawl/status`)
        .then(res => res.json())
        .then(data => setCrawlStatus(data))
        .catch(err => console.error('Failed to fetch crawl status:', err))
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 1000)
    return () => clearInterval(interval)
  }, [])

  const startCrawlSeries = async () => {
    if (!selectedSeriesId) return

    try {
      await fetch(`${API_BASE}/api/crawl/series`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series_id: selectedSeriesId })
      })
    } catch (err) {
      console.error('Failed to start crawl:', err)
    }
  }

  const startCrawlAll = async () => {
    if (!confirm('全シリーズをクロールしますか？時間がかかります。')) return

    try {
      await fetch(`${API_BASE}/api/crawl/all`, { method: 'POST' })
    } catch (err) {
      console.error('Failed to start crawl all:', err)
    }
  }

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '未取得'
    const date = new Date(isoString)
    return date.toLocaleString('ja-JP')
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>Admin - カード管理</h1>
        <a href="/" className="back-link">← デッキビルダーに戻る</a>
      </header>

      <main className="admin-main">
        {/* 統計 */}
        <section className="admin-section">
          <h2>統計</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{cardCount}</div>
              <div className="stat-label">保存済みカード画像</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{cardsData?.total_cards || 0}</div>
              <div className="stat-label">カード情報(JSON)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{series.length}</div>
              <div className="stat-label">シリーズ数</div>
            </div>
          </div>
          <div className="last-updated" style={{ marginTop: '1rem' }}>
            シリーズ最終更新: {formatDate(seriesLastUpdated)}
            <br />
            カード情報最終更新: {formatDate(cardsData?.crawled_at || null)}
          </div>
        </section>

        {/* クローリング */}
        <section className="admin-section">
          <h2>カードをダウンロード</h2>

          <div className="crawl-form">
            <div className="form-group">
              <label>シリーズを選択</label>
              {series.length === 0 ? (
                <p>シリーズデータがありません</p>
              ) : (
                <select
                  value={selectedSeriesId}
                  onChange={e => setSelectedSeriesId(e.target.value)}
                  disabled={crawlStatus?.is_running}
                >
                  {series.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="button-row">
              <button
                className="crawl-button"
                onClick={startCrawlSeries}
                disabled={crawlStatus?.is_running || !selectedSeriesId}
              >
                {crawlStatus?.is_running ? 'クロール中...' : '選択シリーズをクロール'}
              </button>

              <button
                className="crawl-button secondary"
                onClick={startCrawlAll}
                disabled={crawlStatus?.is_running}
              >
                全シリーズをクロール
              </button>
            </div>
          </div>

          {/* 進捗表示 */}
          {crawlStatus && crawlStatus.status !== 'idle' && (
            <div className="crawl-status">
              <div className="status-header">
                <span className={`status-badge ${crawlStatus.status}`}>
                  {crawlStatus.status === 'running' && '実行中'}
                  {crawlStatus.status === 'completed' && '完了'}
                  {crawlStatus.status === 'error' && 'エラー'}
                </span>
                <span className="status-message">{crawlStatus.message}</span>
              </div>

              {crawlStatus.series_name && (
                <div className="current-series">
                  現在: {crawlStatus.series_name}
                </div>
              )}

              {crawlStatus.errors.length > 0 && (
                <div className="error-list">
                  <h4>エラー詳細</h4>
                  <ul>
                    {crawlStatus.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* シリーズ一覧 */}
        <section className="admin-section">
          <h2>シリーズ一覧</h2>
          {series.length === 0 ? (
            <p>シリーズデータがありません</p>
          ) : (
            <div className="series-list">
              {series.map(s => (
                <div key={s.id} className="series-item">
                  <span className="series-id">{s.id}</span>
                  <span className="series-name">{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
