import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { getCardThumbnailUrl } from '../utils/cardImage'

interface DeckCard {
  id: string
  name: string
  image: string
  series_id?: string
  count: number
  card_type?: string
}

interface VirtualDeckListProps {
  cards: DeckCard[]
  maxCopies: number
  onAddCard: (card: DeckCard) => void
  onRemoveCard: (cardId: string) => void
}

export default function VirtualDeckList({
  cards,
  maxCopies,
  onAddCard,
  onRemoveCard,
}: VirtualDeckListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52, // deck-card height + gap
    overscan: 5,
  })

  if (cards.length === 0) {
    return (
      <div className="deck-list deck-list-empty">
        <p>カードをクリックしてデッキに追加</p>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="deck-list">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const card = cards[virtualRow.index]
          return (
            <div
              key={card.id}
              className="deck-card"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <img
                src={getCardThumbnailUrl(card.id, 'xs', card.series_id)}
                alt={card.name}
                loading="lazy"
              />
              <div className="deck-card-info">
                <span className="deck-card-name">{card.name}</span>
                <div className="deck-card-controls">
                  <button onClick={() => onRemoveCard(card.id)}>-</button>
                  <span>{card.count}</span>
                  <button
                    onClick={() => onAddCard(card)}
                    disabled={card.count >= maxCopies}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
