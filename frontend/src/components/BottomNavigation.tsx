import './BottomNavigation.css'

export type TabType = 'cards' | 'deck'

interface BottomNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  deckCount: number
  maxDeckSize: number
  hasActiveFilters: boolean
  onFilterToggle: () => void
}

export default function BottomNavigation({
  activeTab,
  onTabChange,
  deckCount,
  maxDeckSize,
  hasActiveFilters,
  onFilterToggle,
}: BottomNavigationProps) {
  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${activeTab === 'cards' ? 'active' : ''}`}
        onClick={() => onTabChange('cards')}
        aria-label="カード一覧"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M4 5h3v13H4V5zm5 0h3v13H9V5zm5 0h3v13h-3V5zm5 0h3v13h-3V5z"
          />
        </svg>
        <span>カード</span>
      </button>

      <button
        className={`nav-item filter-item ${hasActiveFilters ? 'has-filters' : ''}`}
        onClick={onFilterToggle}
        aria-label="フィルター"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"
          />
        </svg>
        <span>フィルター</span>
        {hasActiveFilters && <span className="filter-dot" />}
      </button>

      <button
        className={`nav-item ${activeTab === 'deck' ? 'active' : ''}`}
        onClick={() => onTabChange('deck')}
        aria-label="デッキ"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"
          />
        </svg>
        <span>デッキ</span>
        <span className="deck-count-badge">
          {deckCount}/{maxDeckSize}
        </span>
      </button>
    </nav>
  )
}
