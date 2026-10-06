import './ContentSkeletons.css'

export function Skeleton({ className = '' }) {
  return <span className={`content-skeleton ${className}`} aria-hidden="true" />
}

export function OrderCardSkeleton() {
  return (
    <div className="order-card-skeleton" role="status" aria-label="Loading order">
      <Skeleton className="order-skeleton-icon" />
      <div className="order-skeleton-copy">
        <Skeleton className="skeleton-line skeleton-line-long" />
        <Skeleton className="skeleton-line skeleton-line-medium" />
        <Skeleton className="skeleton-line skeleton-line-short" />
      </div>
      <Skeleton className="order-skeleton-status" />
    </div>
  )
}

export function OrderTrackingSkeleton() {
  return (
    <div className="tracking-skeleton-shell" role="status" aria-label="Loading order details">
      <div className="tracking-skeleton-main">
        <div className="tracking-skeleton-header">
          <Skeleton className="skeleton-line skeleton-line-medium" />
        </div>
        <div className="tracking-skeleton-hero">
          <Skeleton className="order-skeleton-icon" />
          <div className="tracking-skeleton-copy">
            <Skeleton className="skeleton-line skeleton-line-long" />
            <Skeleton className="skeleton-line skeleton-line-medium" />
            <Skeleton className="skeleton-line skeleton-line-short" />
          </div>
        </div>
        <div className="tracking-skeleton-steps">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="tracking-skeleton-step" key={index}>
              <Skeleton className="tracking-skeleton-bullet" />
              <div className="tracking-skeleton-step-copy">
                <Skeleton className="skeleton-line skeleton-line-medium" />
                <Skeleton className="skeleton-line skeleton-line-short" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <aside className="tracking-skeleton-aside">
        <Skeleton className="skeleton-line skeleton-line-long" />
        <Skeleton className="skeleton-line skeleton-line-medium" />
        <Skeleton className="skeleton-line skeleton-line-long" />
        <Skeleton className="skeleton-line skeleton-line-medium" />
        <Skeleton className="skeleton-line skeleton-line-short" />
        <Skeleton className="skeleton-line skeleton-line-medium" />
      </aside>
    </div>
  )
}

export function ListingCardSkeleton() {
  return (
    <div className="listing-card-skeleton" role="status" aria-label="Loading listings">
      <Skeleton className="skeleton-line skeleton-line-short" />
      <Skeleton className="skeleton-line skeleton-line-long" />
      <Skeleton className="skeleton-line skeleton-line-long" />
      <Skeleton className="skeleton-line skeleton-line-medium" />
      <Skeleton className="skeleton-line skeleton-line-short" />
    </div>
  )
}

export function DashboardRowSkeleton({ columns = 5 }) {
  return (
    <div
      className="dashboard-row-skeleton"
      role="status"
      aria-label="Loading dashboard data"
      style={{ '--skeleton-columns': columns }}
    >
      {Array.from({ length: columns }, (_, index) => (
        <Skeleton className={`skeleton-line dashboard-row-cell dashboard-row-cell-${index + 1}`} key={index} />
      ))}
    </div>
  )
}
