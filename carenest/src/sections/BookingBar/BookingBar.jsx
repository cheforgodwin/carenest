import Icon from '../../components/Icon/Icon'
import './BookingBar.css'

function BookingBar() {
  return (
    <section className="booking-band" id="book" aria-label="Quick booking form">
      <div className="booking-shell">
        <label>
          Service
          <select defaultValue="laundry">
            <option value="laundry">Laundry pickup</option>
            <option value="cleaning">Home cleaning</option>
            <option value="essentials">Essentials delivery</option>
            <option value="repairs">Repairs support</option>
          </select>
        </label>
        <label>
          Location
          <span className="booking-field"><Icon name="location" /> Bastos, Yaounde</span>
        </label>
        <label>
          Schedule
          <span className="booking-field"><Icon name="calendar" /> Today, 10:00 AM</span>
        </label>
        <button type="button">Start booking</button>
      </div>
    </section>
  )
}

export default BookingBar
