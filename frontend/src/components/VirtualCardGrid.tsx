import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { getCardThumbnailUrl } from '../utils/cardImage'
import './VirtualCardGrid.css'

interface Card {
  id: string
  name: string
  image: string
  series_id?: string
  card_type?: string
}

interface VirtualCardGridProps {
  cards: Card[]
  isMobile: boolean
  enableHoverZoom: boolean
  maxCopies: number
  getCardCount: (cardId: string) => number
  onAddToDeck: (card: Card) => void
  onRemoveFromDeck: (cardId: string) => void
  onHoverCard: (card: Card | null, x: number, y: number) => void
}

const CARDS_PER_PAGE = 100

export default function VirtualCardGrid({
  cards,
  isMobile,
  enableHoverZoom,
  maxCopies,
  getCardCount,
  onAddToDeck,
  onRemoveFromDeck,
  onHoverCard,
}: VirtualCardGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)

  // ページ計算
  const totalPages = Math.ceil(cards.length / CARDS_PER_PAGE)

  // カード配列が変わったらページをリセット
  useEffect(() => {
    setCurrentPage(1)
  }, [cards.length])

  // 現在のページのカードのみ取得
  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE
    return cards.slice(start, start + CARDS_PER_PAGE)
  }, [cards, currentPage])

  // Observe container width changes
  useEffect(() => {
    const container = parentRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    observer.observe(container)
    // Initial measurement
    setContainerWidth(container.clientWidth)

    return () => observer.disconnect()
  }, [])

  // Calculate card size and columns based on container width
  const { columnCount, cardWidth, cardHeight } = useMemo(() => {
    const gap = 8
    const minCardWidth = isMobile ? 90 : 100
    const maxCardWidth = isMobile ? 120 : 140
    const aspectRatio = 1.4 // Card height / width ratio

    if (containerWidth === 0) {
      // Default values before measurement
      return {
        columnCount: isMobile ? 3 : 5,
        cardWidth: isMobile ? 100 : 120,
        cardHeight: isMobile ? 140 : 168,
      }
    }

    // Calculate how many cards can fit
    const availableWidth = containerWidth - gap
    let cols = Math.floor(availableWidth / (minCardWidth + gap))
    cols = Math.max(2, cols) // At least 2 columns

    // Calculate actual card width to fill the space
    let width = Math.floor((availableWidth - gap * cols) / cols)
    width = Math.min(width, maxCardWidth)
    width = Math.max(width, minCardWidth)

    const height = Math.floor(width * aspectRatio)

    return {
      columnCount: cols,
      cardWidth: width,
      cardHeight: height,
    }
  }, [containerWidth, isMobile])

  const gap = 8

  // Group cards into rows (using paginated cards)
  const rows = useMemo(() => {
    const result: Card[][] = []
    for (let i = 0; i < paginatedCards.length; i += columnCount) {
      result.push(paginatedCards.slice(i, i + columnCount))
    }
    return result
  }, [paginatedCards, columnCount])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => cardHeight + gap, [cardHeight]),
    overscan: 3,
  })

  // Re-measure when card height changes
  useEffect(() => {
    rowVirtualizer.measure()
  }, [cardHeight, rowVirtualizer])

  // ページ変更時にスクロールをトップに戻す
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    if (parentRef.current) {
      parentRef.current.scrollTop = 0
    }
  }, [])

  return (
    <div className="virtual-card-grid-wrapper">
      {/* ページネーション（上部） */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            &lt;
          </button>
          <span className="pagination-info">
            {currentPage} / {totalPages}
          </span>
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            &gt;
          </button>
          <span className="pagination-total">({cards.length}枚)</span>
        </div>
      )}

      <div ref={parentRef} className="virtual-card-grid-container">
        <div
          className="virtual-card-grid"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: 'relative',
          }}
        >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowCards = rows[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              className="virtual-card-row"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'flex',
                gap: `${gap}px`,
                justifyContent: 'flex-start',
                paddingLeft: `${gap}px`,
              }}
            >
              {rowCards.map((card) => {
                const count = getCardCount(card.id)
                const canAdd = count < maxCopies
                return (
                  <div
                    key={card.id}
                    className={`virtual-card-item ${count >= maxCopies ? 'maxed' : ''}`}
                    style={{
                      width: `${cardWidth}px`,
                      height: `${cardHeight}px`,
                    }}
                    onClick={() => !isMobile && canAdd && onAddToDeck(card)}
                    role={!isMobile ? 'button' : undefined}
                    tabIndex={!isMobile ? 0 : undefined}
                    aria-disabled={!isMobile ? !canAdd : undefined}
                    aria-label={!isMobile ? `${card.name}をデッキに追加` : undefined}
                    onKeyDown={(e) => {
                      if (!isMobile && canAdd && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        onAddToDeck(card)
                      }
                    }}
                    onFocus={(e) => {
                      if (!isMobile && enableHoverZoom) {
                        const rect = e.currentTarget.getBoundingClientRect()
                        onHoverCard(card, rect.right + 10, rect.top)
                      }
                    }}
                    onBlur={() => !isMobile && enableHoverZoom && onHoverCard(null, 0, 0)}
                    onMouseEnter={(e) => {
                      if (!isMobile && enableHoverZoom) {
                        const rect = e.currentTarget.getBoundingClientRect()
                        onHoverCard(card, rect.right + 10, rect.top)
                      }
                    }}
                    onMouseLeave={() => enableHoverZoom && onHoverCard(null, 0, 0)}
                  >
                    <img
                      src={getCardThumbnailUrl(card.id, 'sm', card.series_id)}
                      alt={card.name}
                      loading="lazy"
                    />
                    {count > 0 && <div className="card-count">{count}</div>}
                    {isMobile && (
                      <div className="card-controls">
                        <button
                          className="card-control-btn minus"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveFromDeck(card.id)
                          }}
                          disabled={count === 0}
                        >
                          −
                        </button>
                        <button
                          className="card-control-btn plus"
                          onClick={(e) => {
                            e.stopPropagation()
                            onAddToDeck(card)
                          }}
                          disabled={count >= maxCopies}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
