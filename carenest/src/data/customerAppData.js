export const quickActions = [
  { label: 'Laundry', icon: 'washer', to: '/customer/laundry-request' },
  { label: 'Cleaning', icon: 'cleaning', to: '/customer/services' },
  { label: 'Essentials', icon: 'bag', to: '/customer/services' },
  { label: 'Call CareNest', icon: 'phone', to: 'tel:+237612345678' },
]

export const customerServices = [
  {
    title: 'Laundry Service',
    description: 'We wash, iron and deliver to your door.',
    icon: 'washer',
    tone: 'mint',
  },
  {
    title: 'Home Cleaning',
    description: 'Professional cleaning for your home.',
    icon: 'cleaning',
    tone: 'cream',
  },
  {
    title: 'Essentials Delivery',
    description: 'Order household essentials and we deliver fast.',
    icon: 'bag',
    tone: 'sky',
  },
]

export const activity = [
  ['CN-021', 'Laundry', 'Completed', '12 May 2024', '3,000 FCFA'],
  ['CN-018', 'Cleaning', 'Completed', '10 May 2024', '6,000 FCFA'],
]

export const trackingSteps = [
  ['Requested', '12 May 2024, 09:15 AM', 'done'],
  ['Picked Up', '12 May 2024, 10:05 AM', 'done'],
  ['Washing', 'In Progress', 'active'],
  ['Ironing', 'Pending', 'pending'],
  ['Out for Delivery', 'Pending', 'pending'],
  ['Delivered', 'Pending', 'pending'],
]
