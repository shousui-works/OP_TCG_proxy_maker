import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <nav className="footer-nav" aria-label="サイトナビゲーション">
          <div className="footer-section">
            <h3>ツール</h3>
            <ul>
              <li>
                <Link to="/deck">デッキ構築・プロキシ作成</Link>
              </li>
              <li>
                <Link to="/tournaments">戦績管理</Link>
              </li>
              <li>
                <Link to="/analytics">アナリティクス</Link>
              </li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>サポート</h3>
            <ul>
              <li>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSewyF2yFQQp4cCrJ8VJq273D5gUHj7jbTK4_R7YMNLJwWn8HQ/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  お問い合わせ
                </a>
              </li>
            </ul>
          </div>
        </nav>
        <div className="footer-bottom">
          <p className="footer-brand">
            <Link to="/">OP-TCG base</Link>
          </p>
          <p className="footer-copyright">
            ワンピースカードの練習・管理をサポートする無料ツール
          </p>
        </div>
      </div>
    </footer>
  )
}
