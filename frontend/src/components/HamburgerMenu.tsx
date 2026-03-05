import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { DeckVersionInfo } from '../hooks/useFirestoreDeck'
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
  onLoadVersion?: (branchName: string, versionId: string) => void
  fetchVersions?: (branchName: string) => Promise<DeckVersionInfo[]>
  onDeleteVersion?: (branchName: string, versionId: string) => Promise<void>
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
  onLoadVersion,
  fetchVersions,
  onDeleteVersion,
}: HamburgerMenuProps) {
  const [expandedDecks, setExpandedDecks] = useState<Set<string>>(new Set())
  const [deckVersions, setDeckVersions] = useState<Record<string, DeckVersionInfo[]>>({})
  const [loadingVersions, setLoadingVersions] = useState<Set<string>>(new Set())

  const handleLoadDeck = (name: string) => {
    onLoadDeck(name)
    onClose()
  }

  const handleNewDeck = () => {
    onNewDeck()
    onClose()
  }

  const toggleExpanded = useCallback(async (deckName: string) => {
    const newExpanded = new Set(expandedDecks)

    if (newExpanded.has(deckName)) {
      newExpanded.delete(deckName)
      setExpandedDecks(newExpanded)
    } else {
      newExpanded.add(deckName)
      setExpandedDecks(newExpanded)

      // Fetch versions if not already loaded
      if (!deckVersions[deckName] && fetchVersions) {
        setLoadingVersions(prev => new Set(prev).add(deckName))
        try {
          const versions = await fetchVersions(deckName)
          setDeckVersions(prev => ({ ...prev, [deckName]: versions }))
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
  }, [expandedDecks, deckVersions, fetchVersions])

  const handleLoadVersion = (branchName: string, versionId: string) => {
    onLoadVersion?.(branchName, versionId)
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
              {savedDecks.map((deck) => {
                const isExpanded = expandedDecks.has(deck.name)
                const versions = deckVersions[deck.name] || []
                const isLoading = loadingVersions.has(deck.name)
                const hasVersions = fetchVersions != null

                return (
                  <li
                    key={deck.name}
                    className={`deck-item-container ${deck.name === currentDeckName ? 'active' : ''}`}
                  >
                    <div className="deck-item-row">
                      <button
                        className="expand-btn"
                        onClick={() => hasVersions && toggleExpanded(deck.name)}
                        aria-label={isExpanded ? '折りたたむ' : '展開する'}
                        style={{ visibility: hasVersions ? 'visible' : 'hidden' }}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                      <button
                        className="deck-item-btn"
                        onClick={() => handleLoadDeck(deck.name)}
                      >
                        <span className="deck-item-name">{deck.name}</span>
                      </button>
                      <span className="deck-item-count">{deck.deck_count}枚</span>
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
                    </div>

                    {isExpanded && hasVersions && (
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
                                onClick={() => handleLoadVersion(deck.name, version.id)}
                              >
                                {version.name || `v${version.versionNumber}`}
                              </button>
                              {onDeleteVersion && (
                                <button
                                  className="version-delete-btn"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    if (!confirm('このバージョンを削除しますか？')) return
                                    try {
                                      await onDeleteVersion(deck.name, version.id)
                                      // バージョン一覧を更新
                                      if (fetchVersions) {
                                        const updatedVersions = await fetchVersions(deck.name)
                                        setDeckVersions(prev => ({ ...prev, [deck.name]: updatedVersions }))
                                      }
                                    } catch (error) {
                                      console.error('Failed to delete version:', error)
                                    }
                                  }}
                                  aria-label="バージョンを削除"
                                >
                                  ×
                                </button>
                              )}
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

        <div className="menu-footer">
          <Link to="/" className="footer-link" onClick={onClose}>
            ホーム
          </Link>
          <Link to="/tournaments" className="footer-link" onClick={onClose}>
            大会管理
          </Link>
        </div>
      </aside>
    </>
  )
}
