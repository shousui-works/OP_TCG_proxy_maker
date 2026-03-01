import LoginButton from './LoginButton'
import './MobileHeader.css'

interface MobileHeaderProps {
  onMenuToggle: () => void
  currentDeckName: string | null
  hasUnsavedChanges: boolean
}

export default function MobileHeader({
  onMenuToggle,
  currentDeckName,
  hasUnsavedChanges,
}: MobileHeaderProps) {
  return (
    <header className="mobile-header">
      <button
        className="hamburger-btn"
        onClick={onMenuToggle}
        aria-label="メニューを開く"
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      <div className="header-title">
        <h1>OP-TCG base</h1>
        {currentDeckName && (
          <span className="current-deck-name">
            {currentDeckName}
            {hasUnsavedChanges && <span className="unsaved-dot" />}
          </span>
        )}
      </div>

      <div className="header-right">
        <LoginButton />
      </div>
    </header>
  )
}
