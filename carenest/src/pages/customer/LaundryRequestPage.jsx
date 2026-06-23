import { FiCalendar, FiCheck, FiChevronDown, FiClock, FiMapPin, FiZap } from 'react-icons/fi'
import MobileFrame, { AppIcon } from '../../components/MobileApp/MobileFrame'
import './CustomerApp.css'

function LaundryRequestPage() {
  return (
    <MobileFrame title="Laundry Request" backTo="/customer/services" activeTab="services">
      <div className="request-stepper">
        <span className="active"><b>1</b>Details</span>
        <span><b>2</b>Pickup</span>
        <span><b>3</b>Review</span>
      </div>

      <div className="form-group">
        <label>Service Type</label>
        <div className="option-grid">
          <div className="service-option active">
            <span className="selected-mark"><FiCheck /></span>
            <AppIcon name="washer" />
            <strong>Normal</strong>
            <span>2 - 3 Days</span>
          </div>
          <div className="service-option">
            <FiZap />
            <strong>Express</strong>
            <span>24 Hours</span>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>Clothes Type</label>
        <div className="field-box">
          <span>Select type</span>
          <FiChevronDown />
        </div>
      </div>

      <div className="form-group">
        <label>Pickup Address</label>
        <div className="field-box">
          <span><FiMapPin /> Bastos, Yaounde</span>
          <FiChevronDown />
        </div>
      </div>

      <div className="split-fields">
        <div className="form-group">
          <label>Pickup Date</label>
          <div className="field-box"><span><FiCalendar /> 15 May 2024</span></div>
        </div>
        <div className="form-group">
          <label>Pickup Time</label>
          <div className="field-box"><span><FiClock /> 10:00 AM</span></div>
        </div>
      </div>

      <div className="form-group">
        <label>Additional Note (Optional)</label>
        <div className="field-box note-box">
          <span>E.g. Gate code, special instructions...</span>
        </div>
      </div>

      <button className="continue-button" type="button">Continue</button>
    </MobileFrame>
  )
}

export default LaundryRequestPage
