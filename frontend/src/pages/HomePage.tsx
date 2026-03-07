import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import LoginButton from '../components/LoginButton'
import './HomePage.css'

export default function HomePage() {
  return (
    <div className="home-page">
      <Helmet>
        <title>OP-TCG base - ONE PIECEカードゲーム デッキビルダー</title>
        <meta name="description" content="ONE PIECEカードゲームのデッキ構築・戦績管理ツール。カードプールからデッキを作成し、PDF/画像出力が可能。" />
        <link rel="canonical" href="https://op-tcg-base.ludora-base.com/" />
      </Helmet>
      <header className="home-header">
        <h1>OP TCG Base</h1>
        <p className="home-subtitle">ワンピースカードゲーム管理ツール</p>
        <div className="home-login">
          <LoginButton />
        </div>
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
          <p>デッキ作成・プロキシ出力</p>
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
