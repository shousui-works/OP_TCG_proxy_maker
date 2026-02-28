import { Link } from 'react-router-dom'
import './HamburgerMenu.css'

interface SavedDeck {
  name: string
  deck_count: number
}

interface HamburgerMenuProps {
  isOpen: boolean
  onClose: () => void
  savedDecks: SavedDeck[]
  currentDeckName: string | null
  hasUnsavedChanges: boolean
  onLoadDeck: (name: string) => void
  onNewDeck: () => void
  onSave: () => void
  onSaveAs: () => void
  onDeleteDeck: (name: string) => void
}

export default function HamburgerMenu({
  isOpen,
  onClose,
  savedDecks,
  currentDeckName,
  hasUnsavedChanges,
  onLoadDeck,
  onNewDeck,
  onSave,
  onSaveAs,
  onDeleteDeck,
}: HamburgerMenuProps) {
  const handleLoadDeck = (name: string) => {
    onLoadDeck(name)
    onClose()
  }

  const handleNewDeck = () => {
    onNewDeck()
    onClose()
  }

  return (
    <>
      <div
        className={`menu-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`hamburger-menu ${isOpen ? 'open' : ''}`}>
        <div className="menu-header">
          <h2>Menu</h2>
          <button onClick={onClose} className="close-btn" aria-label="閉じる">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="currentColor"
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>
        </div>

        <div className="menu-section">
          <h3>現在のデッキ</h3>
          <div className="current-deck-info">
            <span className="deck-name-display">
              {currentDeckName || '(新規デッキ)'}
            </span>
            {hasUnsavedChanges && (
              <span className="unsaved-badge">未保存</span>
            )}
          </div>
          <div className="deck-actions">
            <button onClick={handleNewDeck} className="action-btn">
              新規
            </button>
            <button
              onClick={onSave}
              className="action-btn primary"
              disabled={!currentDeckName}
            >
              保存
            </button>
            <button onClick={onSaveAs} className="action-btn">
              名前をつけて保存
            </button>
          </div>
        </div>

        <div className="menu-section decks-section">
          <h3>保存済みデッキ</h3>
          {savedDecks.length === 0 ? (
            <p className="no-decks">保存済みデッキはありません</p>
          ) : (
            <ul className="saved-deck-list">
              {savedDecks.map((deck) => (
                <li
                  key={deck.name}
                  className={deck.name === currentDeckName ? 'active' : ''}
                >
                  <button
                    className="deck-item-btn"
                    onClick={() => handleLoadDeck(deck.name)}
                  >
                    <span className="deck-item-name">{deck.name}</span>
                    <span className="deck-item-count">{deck.deck_count}枚</span>
                  </button>
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteDeck(deck.name)
                    }}
                    aria-label={`${deck.name}を削除`}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path
                        fill="currentColor"
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="menu-footer">
          <Link to="/admin" className="admin-link" onClick={onClose}>
            Admin
          </Link>
        </div>
      </aside>
    </>
  )
}
