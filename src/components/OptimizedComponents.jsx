import { memo } from 'react'
import { Link } from 'react-router-dom'
import { FiBriefcase, FiShoppingBag, FiTool } from 'react-icons/fi'

/**
 * Memoized order card to prevent re-renders
 * Only re-renders if order data changes
 */
export const OrderCard = memo(function OrderCard({ order, formatPickupDate, formatPickupTime, formatAmount, formatPlacedAt }) {
  return (
    <Link className="order-card" to={`/dashboard/customer/orders/${order.id}`}>
      <div className="order-icon">{order.service === 'Laundry' ? <FiShoppingBag /> : <FiTool />}</div>
      <div className="order-summary">
        <strong>{order.service} Order - {order.id}</strong>
        <p>Pickup: {formatPickupDate(order.pickupDate)}, {formatPickupTime(order.pickupTime)}</p>
        <p><b>Details:</b> {order.note || order.itemSummary || order.clothesType}</p>
      </div>
      <span>{order.status}</span>
      <div className="mini-progress"><i></i><i></i><i></i><i></i></div>
    </Link>
  )
})

/**
 * Memoized activity item to prevent re-renders
 */
export const ActivityItem = memo(function ActivityItem({ order, formatAmount, formatPlacedAt }) {
  return (
    <Link to={`/dashboard/customer/orders/${order.id}`}>
      {order.service === 'Laundry' ? <FiShoppingBag /> : <FiTool />}
      <strong>{order.id}</strong>
      <span>{order.service}</span>
      <b>{order.status}</b>
      <small>{formatPlacedAt(order)}<br />{formatAmount(order.amount)}</small>
    </Link>
  )
})

/**
 * Memoized service card
 */
export const ServiceCard = memo(function ServiceCard({ service, description, tone, startingPrice, onBooking, formatAmount }) {
  const icons = {
    laundry: <FiShoppingBag />,
    cleaning: <FiTool />,
    delivery: <FiShoppingBag />,
  }
  
  return (
    <article className={`service-card service-card-${tone}`}>
      <div className={`service-art service-art-${tone}`}>
        {icons[tone]}
      </div>
      <div>
        <h2>{service}</h2>
        <p>{description}</p>
        <strong className="service-price">From {formatAmount(startingPrice)}</strong>
        <button onClick={onBooking}>Book Now</button>
      </div>
    </article>
  )
})

OrderCard.displayName = 'OrderCard'
ActivityItem.displayName = 'ActivityItem'
ServiceCard.displayName = 'ServiceCard'
