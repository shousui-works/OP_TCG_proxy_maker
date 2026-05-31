import './FilterPanel.css'

interface Series {
  id: string
  name: string
}

interface FilterPanelProps {
  isOpen: boolean
  onClose: () => void
  isMobile: boolean
  // Search (name/ID)
  searchQuery: string
  onSearchChange: (query: string) => void
  // Feature search (feature/text)
  featureQuery: string
  onFeatureChange: (query: string) => void
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
  // Cost
  costs: number[]
  selectedCosts: number[]
  onCostToggle: (cost: number) => void
  // Attribute
  attributes: string[]
  selectedAttributes: string[]
  onAttributeToggle: (attribute: string) => void
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

// Inline filter icons
const ICONS = {
  cardType: (
    <svg className="inline-filter-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
    </svg>
  ),
  rarity: (
    <svg className="inline-filter-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </svg>
  ),
  cost: (
    <svg className="inline-filter-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
      <text x="12" y="16" textAnchor="middle" fontSize="12" fill="currentColor">C</text>
    </svg>
  ),
  attribute: (
    <svg className="inline-filter-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path
        fill="currentColor"
        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
      />
    </svg>
  ),
}

export default function FilterPanel({
  isOpen,
  onClose,
  isMobile,
  searchQuery,
  onSearchChange,
  featureQuery,
  onFeatureChange,
  colors,
  selectedColors,
  onColorToggle,
  cardTypes,
  selectedCardTypes,
  onTypeToggle,
  rarities,
  selectedRarities,
  onRarityToggle,
  costs,
  selectedCosts,
  onCostToggle,
  attributes,
  selectedAttributes,
  onAttributeToggle,
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
              <label className="filter-label">名前・ID検索</label>
              <input
                type="text"
                className="filter-search"
                placeholder="カード名・ID..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>

            {/* Feature Search */}
            <div className="filter-section">
              <label className="filter-label">特徴・テキスト検索</label>
              <input
                type="text"
                className="filter-search"
                placeholder="麦わらの一味、速攻..."
                value={featureQuery}
                onChange={(e) => onFeatureChange(e.target.value)}
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

            {/* Cost */}
            <div className="filter-section">
              <label className="filter-label">コスト</label>
              <div className="filter-chips cost-chips">
                {costs.map((cost) => (
                  <button
                    key={cost}
                    className={`filter-chip cost-chip ${
                      selectedCosts.includes(cost) ? 'active' : ''
                    }`}
                    onClick={() => onCostToggle(cost)}
                  >
                    {cost}
                  </button>
                ))}
              </div>
            </div>

            {/* Attribute */}
            <div className="filter-section">
              <label className="filter-label">属性</label>
              <div className="filter-chips">
                {attributes.map((attr) => (
                  <button
                    key={attr}
                    className={`filter-chip ${
                      selectedAttributes.includes(attr) ? 'active' : ''
                    }`}
                    onClick={() => onAttributeToggle(attr)}
                  >
                    {attr}
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
                        {ICONS.close}
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
          placeholder="名前・ID..."
          aria-label="名前・ID検索"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        {/* Feature Search */}
        <input
          type="text"
          className="filter-search feature-search"
          placeholder="特徴・テキスト..."
          aria-label="特徴・テキスト検索"
          value={featureQuery}
          onChange={(e) => onFeatureChange(e.target.value)}
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
        <div className="inline-filter-group">
          {ICONS.cardType}
          <div className="inline-filter-chips">
            {cardTypes.map((type) => (
              <button
                key={type}
                className={`inline-filter-chip cardtype ${
                  selectedCardTypes.includes(type) ? 'active' : ''
                }`}
                onClick={() => onTypeToggle(type)}
                title={`タイプ: ${type}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Rarities */}
        <div className="inline-filter-group">
          {ICONS.rarity}
          <div className="inline-filter-chips">
            {rarities.map((rarity) => (
              <button
                key={rarity}
                className={`inline-filter-chip ${
                  selectedRarities.includes(rarity) ? 'active' : ''
                }`}
                onClick={() => onRarityToggle(rarity)}
                title={`レアリティ: ${rarity}`}
              >
                {rarity}
              </button>
            ))}
          </div>
        </div>

        {/* Cost */}
        <div className="inline-filter-group">
          {ICONS.cost}
          <div className="inline-filter-chips">
            {costs.map((cost) => (
              <button
                key={cost}
                className={`inline-filter-chip cost ${
                  selectedCosts.includes(cost) ? 'active' : ''
                }`}
                onClick={() => onCostToggle(cost)}
                title={`コスト ${cost}`}
              >
                {cost}
              </button>
            ))}
          </div>
        </div>

        {/* Attribute */}
        <div className="inline-filter-group">
          {ICONS.attribute}
          <div className="inline-filter-chips">
            {attributes.map((attr) => (
              <button
                key={attr}
                className={`inline-filter-chip attribute ${
                  selectedAttributes.includes(attr) ? 'active' : ''
                }`}
                onClick={() => onAttributeToggle(attr)}
                title={`属性: ${attr}`}
              >
                {attr}
              </button>
            ))}
          </div>
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
                {ICONS.close}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
