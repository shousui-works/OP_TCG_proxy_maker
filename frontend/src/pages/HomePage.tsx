import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../contexts/AuthContext'
import LoginButton from '../components/LoginButton'
import './HomePage.css'

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div className="home-page">
      <Helmet>
        <title>ワンピースカード プロキシメーカー | OP-TCG base</title>
        <meta name="description" content="ワンピースカードのプロキシ作成・デッキ構築ツール。カードを選んでプロキシカードをPDF出力、印刷して練習に使えます。" />
        <link rel="canonical" href="https://op-tcg-base.ludora-base.com/" />
      </Helmet>
      <header className="home-header">
        <h1>OP TCG Base</h1>
        <p className="home-subtitle">ワンピースカードゲームの練習・管理をサポート</p>
        <p className="home-description">
          デッキ構築からプロキシ出力、戦績管理まで。
          <br />
          無料で使えるオールインワンツールです。
        </p>
        {user && (
          <div className="home-login">
            <LoginButton />
          </div>
        )}
      </header>

      <div className="home-menu">
        <Link to="/deck" className="menu-card deck-builder">
          <div className="menu-icon">
            <svg viewBox="0 0 24 24" width="48" height="48">
              <path
                fill="currentColor"
                d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"
              />
            </svg>
          </div>
          <h2>デッキ構築</h2>
          <p>カード検索・デッキ作成・PDF出力</p>
        </Link>

        <Link to="/tournaments" className="menu-card tournaments">
          <div className="menu-icon">
            <svg viewBox="0 0 24 24" width="48" height="48">
              <path
                fill="currentColor"
                d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"
              />
            </svg>
          </div>
          <h2>戦績管理</h2>
          <p>大会・試合記録・勝率管理</p>
        </Link>
      </div>

      {/* ログインセクション（未ログイン時のみ表示） */}
      {!user && (
        <section className="login-section">
          <div className="login-section-content">
            <p className="login-tagline">面倒な登録なし</p>
            <h2>Googleアカウントがあれば OK</h2>
            <p className="login-description">ワンタップでログイン、すぐに使えます</p>
            <ul className="login-benefits">
              <li>作ったデッキをクラウドに保存</li>
              <li>スマホとPCでデッキを共有</li>
              <li>対戦結果を記録して勝率を分析</li>
            </ul>
            <div className="login-section-button">
              <LoginButton />
            </div>
            <p className="login-note">ログインなしでも基本機能は使えます</p>
          </div>
        </section>
      )}

      {/* 機能紹介セクション */}
      <section className="features-section">
        <div className="feature-item">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" width="32" height="32">
              <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </div>
          <div className="feature-content">
            <h3>全カード対応</h3>
            <p>最新弾まで全カードを収録。名前・色・コストなど多彩な条件で検索できます。</p>
          </div>
        </div>

        <div className="feature-item">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" width="32" height="32">
              <path fill="currentColor" d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
            </svg>
          </div>
          <div className="feature-content">
            <h3>プロキシ印刷</h3>
            <p>作成したデッキをPDF出力。A4用紙に印刷してすぐに練習できます。</p>
          </div>
        </div>

        <div className="feature-item">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" width="32" height="32">
              <path fill="currentColor" d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
            </svg>
          </div>
          <div className="feature-content">
            <h3>勝率分析</h3>
            <p>対戦結果を記録して、デッキごと・相手ごとの勝率を自動で集計します。</p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSewyF2yFQQp4cCrJ8VJq273D5gUHj7jbTK4_R7YMNLJwWn8HQ/viewform"
          target="_blank"
          rel="noopener noreferrer"
          className="contact-link"
        >
          お問い合わせ
        </a>
        <Link to="/admin" className="admin-link">Admin</Link>
      </footer>
    </div>
  )
}
