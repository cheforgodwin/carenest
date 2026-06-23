import {
  FiCalendar,
  FiCreditCard,
  FiMapPin,
  FiPhone,
  FiShield,
  FiShoppingBag,
  FiTool,
  FiZap,
} from 'react-icons/fi'
import { TbWashMachine } from 'react-icons/tb'
import './Icon.css'

function Icon({ name }) {
  const icons = {
    basket: FiShoppingBag,
    calendar: FiCalendar,
    card: FiCreditCard,
    location: FiMapPin,
    phone: FiPhone,
    shield: FiShield,
    sparkle: FiZap,
    tool: FiTool,
    washer: TbWashMachine,
  }

  const SelectedIcon = icons[name] || FiZap

  return <SelectedIcon className="ui-icon" aria-hidden="true" focusable="false" />
}

export default Icon
