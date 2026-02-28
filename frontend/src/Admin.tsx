import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Admin.css'
import { useAuth } from './contexts/AuthContext'
import LoginButton from './components/LoginButton'

interface Series {
  id: string
  name: string
  url: string
}

interface CardsData {
  total_cards: number
  crawled_at: string | null
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAIL || '').split(',').map((e: string) => e.trim())

export default function Admin() {
  const { user, loading } = useAuth()
  const [series, setSeries] = useState<Series[]>([])
  const [seriesLastUpdated, setSeriesLastUpdated] = useState<string | null>(null)
  const [cardCount, setCardCount] = useState(0)
  const [cardsData, setCardsData] = useState<CardsData | null>(null)

  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '')

  // シリーズ一覧を取得
  useEffect(() => {
    if (!isAdmin) return
    fetch(`${API_BASE}/api/series`)
      .then(res => res.json())
      .then(data => {
        setSeries(data.series || [])
        setSeriesLastUpdated(data.last_updated)
      })
      .catch(err => console.error('Failed to fetch series:', err))
  }, [isAdmin])

  // カード画像数を取得
  useEffect(() => {
    if (!isAdmin) return
    fetch(`${API_BASE}/api/cards`)
      .then(res => res.json())
      .then(data => setCardCount(data.cards?.length || 0))
      .catch(err => console.error('Failed to fetch cards:', err))
  }, [isAdmin])

  // カードデータを取得
  useEffect(() => {
    if (!isAdmin) return
    fetch(`${API_BASE}/api/cards/data`)
      .then(res => res.json())
      .then(data => setCardsData(data))
      .catch(err => console.error('Failed to fetch cards data:', err))
  }, [isAdmin])

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '未取得'
    const date = new Date(isoString)
    return date.toLocaleString('ja-JP')
  }

  // ローディング中
  if (loading) {
    return (
      <div className="admin">
        <header className="admin-header">
          <h1>Admin - カード管理</h1>
          <Link to="/" className="back-link">← デッキビルダーに戻る</Link>
        </header>
        <main className="admin-main">
          <p>読み込み中...</p>
        </main>
      </div>
    )
  }

  // 未ログインまたは管理者でない場合
  if (!isAdmin) {
    return (
      <div className="admin">
        <header className="admin-header">
          <h1>Admin - カード管理</h1>
          <Link to="/" className="back-link">← デッキビルダーに戻る</Link>
        </header>
        <main className="admin-main">
          <section className="admin-section">
            <h2>アクセス拒否</h2>
            <p>このページは管理者のみアクセスできます。</p>
            {!user ? (
              <div style={{ marginTop: '1rem' }}>
                <p>管理者アカウントでログインしてください。</p>
                <LoginButton />
              </div>
            ) : (
              <p>ログイン中: {user.email}</p>
            )}
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>Admin - カード管理</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" className="back-link">← デッキビルダーに戻る</Link>
          <LoginButton />
        </div>
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
