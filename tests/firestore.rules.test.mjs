import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'

let env
const projectId = 'demo-carenest'
const verified = { email_verified: true }
const baseOrder = {
  id: 'CN-TEST', customerUid: 'customer-a', customerEmail: 'a@example.com', customerPhone: '+237670000001',
  serviceType: 'laundry', serviceSpeed: 'Normal', itemSummary: 'Mixed clothes', amount: 3000,
  status: 'Pending', currentStep: 0, paymentMethod: 'Fapshi', paymentStatus: 'Pending',
}

const baseListing = {
  providerUid: 'provider-a', providerName: 'Provider A', providerPhone: '+237670000003',
  title: '12.5 kg gas refill', category: 'gas', kind: 'product',
  description: 'Delivered gas refill for household cooking.',
  price: 6500, unit: 'cylinder', serviceArea: 'Bastos, Yaounde', turnaround: '60 minutes',
  options: ['12.5 kg'], stockTracked: true, stockQuantity: 4, active: true,
  createdAt: new Date(), updatedAt: new Date(),
}
before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
beforeEach(() => env.clearFirestore())
after(() => env.cleanup())

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'users/customer-a'), { uid: 'customer-a', email: 'a@example.com', accountType: 'customer' })
    await setDoc(doc(db, 'users/customer-b'), { uid: 'customer-b', email: 'b@example.com', accountType: 'customer' })
    await setDoc(doc(db, 'users/provider-a'), { uid: 'provider-a', email: 'p@example.com', accountType: 'provider' })
    await setDoc(doc(db, 'users/admin-a'), { uid: 'admin-a', email: 'admin@example.com', accountType: 'admin' })
    await setDoc(doc(db, 'serviceRequests/order-a'), baseOrder)
    await setDoc(doc(db, 'providerListings/listing-a'), baseListing)
  })
}

test('signed-out users cannot read orders', async () => {
  await seed()
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'serviceRequests/order-a')))
})

test('a customer without a profile document can still create a booking when auth email matches', async () => {
  const db = env.authenticatedContext('customer-c', { email_verified: true, email: 'c@example.com' }).firestore()
  await assertSucceeds(setDoc(doc(db, 'serviceRequests/order-c'), {
    id: 'CN-TEST-2', customerUid: 'customer-c', customerEmail: 'c@example.com', customerPhone: '+237670000002',
    serviceType: 'laundry', serviceSpeed: 'Normal', itemSummary: 'Mixed clothes', amount: 3000,
    status: 'Pending', currentStep: 0, paymentMethod: 'Fapshi', paymentStatus: 'Pending',
  }))
})

test('a customer can read only their own order', async () => {
  await seed()
  await assertSucceeds(getDoc(doc(env.authenticatedContext('customer-a').firestore(), 'serviceRequests/order-a')))
  await assertFails(getDoc(doc(env.authenticatedContext('customer-b').firestore(), 'serviceRequests/order-a')))
})

test('a customer cannot create a changed price', async () => {
  await seed()
  const db = env.authenticatedContext('customer-a', verified).firestore()
  await assertFails(setDoc(doc(db, 'serviceRequests/bad-price'), { ...baseOrder, amount: 1 }))
  await assertSucceeds(setDoc(doc(db, 'serviceRequests/good-price'), baseOrder))
})

test('providers own secure storefront listings', async () => {
  await seed()
  const provider = env.authenticatedContext('provider-a').firestore()
  await assertSucceeds(setDoc(doc(provider, 'providerListings/provider-created'), {
    ...baseListing,
    title: 'Cooking gas delivery',
  }))

  const customer = env.authenticatedContext('customer-a').firestore()
  await assertFails(setDoc(doc(customer, 'providerListings/customer-listing'), {
    ...baseListing,
    providerUid: 'customer-a',
  }))
  await assertFails(updateDoc(doc(customer, 'providerListings/listing-a'), { price: 100 }))
})

test('marketplace orders use the published listing price and stock', async () => {
  await seed()
  const db = env.authenticatedContext('customer-a', verified).firestore()
  const marketplaceOrder = {
    id: 'CN-MARKET', customerUid: 'customer-a', customerEmail: 'a@example.com',
    customerPhone: '+237670000001', service: '12.5 kg gas refill',
    serviceType: 'marketplace', serviceSpeed: 'Standard', itemSummary: '12.5 kg gas refill',
    listingId: 'listing-a', listingCategory: 'gas', providerUid: 'provider-a',
    providerName: 'Provider A', unitPrice: 6500, quantity: 2, amount: 13000,
    orderDetails: { orderType: 'Refill', variant: '12.5 kg' },
    status: 'Pending', currentStep: 0, paymentMethod: 'Mobile Money', paymentStatus: 'Pending',
  }

  await assertSucceeds(setDoc(doc(db, 'serviceRequests/market-good'), marketplaceOrder))
  await assertFails(setDoc(doc(db, 'serviceRequests/market-cheap'), { ...marketplaceOrder, amount: 100 }))
  await assertFails(setDoc(doc(db, 'serviceRequests/market-stock'), { ...marketplaceOrder, quantity: 5, amount: 32500 }))
  await assertFails(setDoc(doc(db, 'serviceRequests/market-provider'), { ...marketplaceOrder, providerUid: 'provider-b' }))
})
test('a customer cannot change role or payment state', async () => {
  await seed()
  const db = env.authenticatedContext('customer-a', verified).firestore()
  await assertFails(updateDoc(doc(db, 'users/customer-a'), { accountType: 'admin' }))
  await assertFails(updateDoc(doc(db, 'serviceRequests/order-a'), { paymentStatus: 'Paid' }))
})

test('signed-in customers can create bookings and pending provider applications', async () => {
  await seed()
  const db = env.authenticatedContext('customer-a', { email_verified: false }).firestore()
  await assertSucceeds(setDoc(doc(db, 'serviceRequests/unverified-order'), baseOrder))
  await assertSucceeds(setDoc(doc(db, 'providerApplications/customer-a'), {
    userUid: 'customer-a', name: 'Customer A', email: 'a@example.com', phone: '+237670000001',
    services: 'Cleaning', area: 'Douala', experience: 'Two years', status: 'Pending',
    identityVerified: false, payoutPhoneVerified: false,
  }))
  await assertFails(updateDoc(doc(db, 'users/customer-a'), { emailVerified: true }))
})

test('a verified customer cannot self-approve provider checks', async () => {
  await seed()
  const db = env.authenticatedContext('customer-a', verified).firestore()
  const application = doc(db, 'providerApplications/customer-a')
  await assertSucceeds(setDoc(application, {
    userUid: 'customer-a', name: 'Customer A', email: 'a@example.com', phone: '+237670000001',
    services: 'Cleaning', area: 'Douala', experience: 'Two years', status: 'Pending',
    identityVerified: false, payoutPhoneVerified: false,
  }))
  await assertFails(updateDoc(application, { identityVerified: true, payoutPhoneVerified: true }))
})

test('only one provider wins concurrent acceptance', async () => {
  await seed()
  const first = env.authenticatedContext('provider-a', verified).firestore()
  await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), 'users/provider-b'), { uid: 'provider-b', accountType: 'provider' }))
  const second = env.authenticatedContext('provider-b', verified).firestore()
  const accept = (db, uid) => updateDoc(doc(db, 'serviceRequests/order-a'), {
    providerUid: uid, providerName: uid, providerEmail: `${uid}@example.com`, providerPhone: '',
    status: 'Assigned', currentStep: 1, assignedAt: new Date(), updatedAt: new Date(),
  })
  const outcomes = await Promise.allSettled([accept(first, 'provider-a'), accept(second, 'provider-b')])
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1)
})

test('an admin-approved provider can see open jobs without email verification', async () => {
  await seed()
  const db = env.authenticatedContext('provider-a', { email_verified: false }).firestore()
  await assertSucceeds(getDocs(query(collection(db, 'serviceRequests'), where('status', '==', 'Pending'))))
})

test('a provider cannot edit price or another provider job', async () => {
  await seed()
  const db = env.authenticatedContext('provider-a', verified).firestore()
  await assertFails(updateDoc(doc(db, 'serviceRequests/order-a'), { amount: 9000 }))
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), { providerUid: 'provider-b', status: 'Assigned', currentStep: 1 }))
  await assertFails(updateDoc(doc(db, 'serviceRequests/order-a'), { status: 'In Progress', currentStep: 2, updatedAt: new Date() }))
})

test('a provider needs completion proof and cannot change payout state', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), {
    providerUid: 'provider-a', status: 'Out for Delivery', currentStep: 4,
  }))
  const order = doc(env.authenticatedContext('provider-a', verified).firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(order, {
    status: 'Completed', currentStep: 5, completionProofText: 'short', completedAt: new Date(), updatedAt: new Date(),
  }))
  await assertSucceeds(updateDoc(order, {
    status: 'Completed', currentStep: 5, completionProofText: 'Delivered to the customer.', completedAt: new Date(), updatedAt: new Date(),
  }))
  await assertFails(updateDoc(order, { payoutStatus: 'Paid' }))
})

test('a customer can submit a valid complaint but cannot forge its payout outcome', async () => {
  await seed()
  const order = doc(env.authenticatedContext('customer-a', verified).firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(order, {
    status: 'Complaint', currentStep: 2, complaintText: 'Too short', complaintSubmittedAt: new Date(),
    payoutStatus: 'Held', payoutNote: 'Provider payout held while customer complaint is reviewed.', updatedAt: new Date(),
  }))
  await assertSucceeds(updateDoc(order, {
    status: 'Complaint', currentStep: 2, complaintText: 'The service was not completed as requested.', complaintSubmittedAt: new Date(),
    payoutStatus: 'Held', payoutNote: 'Provider payout held while customer complaint is reviewed.', updatedAt: new Date(),
  }))
  await assertFails(updateDoc(order, { payoutStatus: 'Paid' }))
})

test('an admin can pay only eligible provider payouts', async () => {
  await seed()
  const order = doc(env.authenticatedContext('admin-a').firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(order, { payoutStatus: 'Unknown' }))
  await assertFails(updateDoc(order, { payoutStatus: 'Paid' }))
  await assertSucceeds(updateDoc(order, { status: 'Completed', currentStep: 5, paymentStatus: 'Paid', payoutStatus: 'Paid' }))
})
