import { Link, useLocation } from 'react-router-dom'
import './PageNav.css'

const navItems = [
  { path: '/', label: 'ホーム' },
  { path: '/deck', label: 'デッキ' },
  { path: '/tournaments', label: '戦績' },
  { path: '/analytics', label: '分析' },
]

export default function PageNav() {
  const location = useLocation()

  return (
    <nav className="page-nav">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
