import './CardGridSkeleton.css'

interface CardGridSkeletonProps {
  cardCount?: number
}

export default function CardGridSkeleton({ cardCount = 12 }: CardGridSkeletonProps) {
  return (
    <div className="card-grid-skeleton">
      {Array.from({ length: cardCount }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-image" />
        </div>
      ))}
    </div>
  )
}
