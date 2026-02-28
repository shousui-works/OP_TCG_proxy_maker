import './FilterPanel.css'

interface Series {
  id: string
  name: string
}

interface FilterPanelProps {
  isOpen: boolean
  onClose: () => void
  isMobile: boolean
  // Search
  searchQuery: string
  onSearchChange: (query: string) => void
  // Colors
  colors: string[]
  selectedColors: string[]
  onColorToggle: (color: string) => void
  // Card types
  cardTypes: string[]
  selectedCardTypes: string[]
  onTypeToggle: (type: string) => void
  // Rarities
  rarities: string[]
  selectedRarities: string[]
  onRarityToggle: (rarity: string) => void
  // Series
  series: Series[]
  selectedSeries: string[]
  onSeriesAdd: (id: string) => void
  onSeriesRemove: (id: string) => void
  // Clear
  onClearFilters: () => void
  hasActiveFilters: boolean
}

const COLOR_LABELS: Record<string, string> = {
  '赤': 'Red',
  '緑': 'Green',
  '青': 'Blue',
  '紫': 'Purple',
  '黒': 'Black',
  '黄': 'Yellow',
}

const COLOR_STYLES: Record<string, string> = {
  '赤': '#e94560',
  '緑': '#4caf50',
  '青': '#2196f3',
  '紫': '#9c27b0',
  '黒': '#424242',
  '黄': '#ffeb3b',
}

export default function FilterPanel({
  isOpen,
  onClose,
  isMobile,
  searchQuery,
  onSearchChange,
  colors,
  selectedColors,
  onColorToggle,
  cardTypes,
  selectedCardTypes,
  onTypeToggle,
  rarities,
  selectedRarities,
  onRarityToggle,
  series,
  selectedSeries,
  onSeriesAdd,
  onSeriesRemove,
  onClearFilters,
  hasActiveFilters,
}: FilterPanelProps) {
  const availableSeries = series.filter((s) => !selectedSeries.includes(s.id))

  // For mobile: full screen modal
  if (isMobile) {
    return (
      <>
        <div
          className={`filter-backdrop ${isOpen ? 'open' : ''}`}
          onClick={onClose}
          aria-hidden="true"
        />
        <div className={`filter-panel-mobile ${isOpen ? 'open' : ''}`}>
          <div className="filter-panel-header">
            <h2>フィルター</h2>
            <button onClick={onClose} className="close-btn" aria-label="閉じる">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="currentColor"
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          </div>

          <div className="filter-panel-content">
            {/* Search */}
            <div className="filter-section">
              <label className="filter-label">検索</label>
              <input
                type="text"
                className="filter-search"
                placeholder="カード名・ID..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>

            {/* Colors */}
            <div className="filter-section">
              <label className="filter-label">カラー</label>
              <div className="filter-chips">
                {colors.map((color) => (
                  <button
                    key={color}
                    className={`filter-chip color-chip ${
                      selectedColors.includes(color) ? 'active' : ''
                    }`}
                    style={
                      {
                        '--chip-color': COLOR_STYLES[color] || '#888',
                      } as React.CSSProperties
                    }
                    onClick={() => onColorToggle(color)}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            {/* Card Types */}
            <div className="filter-section">
              <label className="filter-label">カードタイプ</label>
              <div className="filter-chips">
                {cardTypes.map((type) => (
                  <button
                    key={type}
                    className={`filter-chip ${
                      selectedCardTypes.includes(type) ? 'active' : ''
                    }`}
                    onClick={() => onTypeToggle(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Rarities */}
            <div className="filter-section">
              <label className="filter-label">レアリティ</label>
              <div className="filter-chips">
                {rarities.map((rarity) => (
                  <button
                    key={rarity}
                    className={`filter-chip ${
                      selectedRarities.includes(rarity) ? 'active' : ''
                    }`}
                    onClick={() => onRarityToggle(rarity)}
                  >
                    {rarity}
                  </button>
                ))}
              </div>
            </div>

            {/* Series */}
            <div className="filter-section">
              <label className="filter-label">シリーズ</label>
              <select
                className="filter-select"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    onSeriesAdd(e.target.value)
                  }
                }}
              >
                <option value="">シリーズを選択...</option>
                {availableSeries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {selectedSeries.length > 0 && (
                <div className="filter-chips selected-series">
                  {selectedSeries.map((id) => {
                    const s = series.find((x) => x.id === id)
                    return (
                      <button
                        key={id}
                        className="filter-chip active removable"
                        onClick={() => onSeriesRemove(id)}
                      >
                        {s?.name || id}
                        <svg viewBox="0 0 24 24" width="16" height="16">
                          <path
                            fill="currentColor"
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                          />
                        </svg>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="filter-panel-footer">
            {hasActiveFilters && (
              <button onClick={onClearFilters} className="clear-btn">
                クリア
              </button>
            )}
            <button onClick={onClose} className="apply-btn">
              適用
            </button>
          </div>
        </div>
      </>
    )
  }

  // For desktop: inline collapsible
  return (
    <div className={`filter-panel-desktop ${isOpen ? 'open' : ''}`}>
      <div className="filter-row">
        {/* Search */}
        <input
          type="text"
          className="filter-search"
          placeholder="検索..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        {/* Colors */}
        <div className="filter-chips">
          {colors.map((color) => (
            <button
              key={color}
              className={`filter-chip color-chip ${
                selectedColors.includes(color) ? 'active' : ''
              }`}
              style={
                {
                  '--chip-color': COLOR_STYLES[color] || '#888',
                } as React.CSSProperties
              }
              onClick={() => onColorToggle(color)}
              title={COLOR_LABELS[color]}
            >
              {color}
            </button>
          ))}
        </div>

        {/* Card Types */}
        <div className="filter-chips">
          {cardTypes.map((type) => (
            <button
              key={type}
              className={`filter-chip ${
                selectedCardTypes.includes(type) ? 'active' : ''
              }`}
              onClick={() => onTypeToggle(type)}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Rarities */}
        <div className="filter-chips">
          {rarities.map((rarity) => (
            <button
              key={rarity}
              className={`filter-chip ${
                selectedRarities.includes(rarity) ? 'active' : ''
              }`}
              onClick={() => onRarityToggle(rarity)}
            >
              {rarity}
            </button>
          ))}
        </div>

        {/* Series */}
        <select
          className="filter-select"
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onSeriesAdd(e.target.value)
            }
          }}
        >
          <option value="">シリーズ...</option>
          {availableSeries.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Clear */}
        {hasActiveFilters && (
          <button onClick={onClearFilters} className="clear-btn-inline">
            クリア
          </button>
        )}
      </div>

      {/* Selected series chips */}
      {selectedSeries.length > 0 && (
        <div className="filter-row selected-series-row">
          {selectedSeries.map((id) => {
            const s = series.find((x) => x.id === id)
            return (
              <button
                key={id}
                className="filter-chip active removable"
                onClick={() => onSeriesRemove(id)}
              >
                {s?.name || id}
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    fill="currentColor"
                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  />
                </svg>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
