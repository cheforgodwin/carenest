import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'

let env
const projectId = 'demo-carenest'
const verified = { email_verified: true }
const baseOrder = {
  id: 'CN-TEST', customerUid: 'customer-a', customerEmail: 'a@example.com', customerPhone: '+237670000001',
  serviceType: 'laundry', serviceSpeed: 'Normal', itemSummary: 'Mixed clothes', amount: 3000,
  status: 'Pending', currentStep: 0, paymentMethod: 'Fapshi', paymentStatus: 'Pending',
}

const verifiedPayment = { paymentStatus: 'Paid', paymentVerifiedAt: new Date(), paymentVerifiedBy: 'fapshi-webhook' }

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
    await setDoc(doc(db, 'users/rider-a'), { uid: 'rider-a', email: 'r@example.com', accountType: 'rider' })
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

test('only admins can set marketplace moderation metadata', async () => {
  await seed()
  const provider = env.authenticatedContext('provider-a').firestore()
  await assertFails(updateDoc(doc(provider, 'providerListings/listing-a'), {
    moderationStatus: 'Approved',
    moderationNote: 'Self approved',
    reviewedBy: 'provider-a',
    reviewedAt: new Date(),
  }))

  const admin = env.authenticatedContext('admin-a').firestore()
  await assertSucceeds(updateDoc(doc(admin, 'providerListings/listing-a'), {
    active: false,
    moderationStatus: 'Hidden',
    moderationNote: 'Listing requires review.',
    reviewedBy: 'admin-a',
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }))
})
test('riders can access only assigned deliveries and update their own progress', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'serviceRequests/delivery-a'), {
      ...baseOrder, ...verifiedPayment, id: 'CN-DELIVERY', serviceType: 'delivery', serviceSpeed: 'Standard',
      itemSummary: 'Groceries', amount: 2500, status: 'Out for Delivery', currentStep: 4, createdAt: new Date(),
    })
  })

  const rider = env.authenticatedContext('rider-a').firestore()
  const openDeliveries = query(collection(rider, 'serviceRequests'), where('serviceType', '==', 'delivery'), where('status', '==', 'Out for Delivery'))
  await assertFails(getDocs(openDeliveries))
  await assertFails(updateDoc(doc(rider, 'serviceRequests/delivery-a'), {
    riderUid: 'rider-a', riderName: 'Rider A', riderPhone: '+237670000004',
    riderStatus: 'Accepted', riderAssignedAt: new Date(), updatedAt: new Date(),
  }))

  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/delivery-a'), {
    riderUid: 'rider-a', riderName: 'Rider A', riderPhone: '+237670000004',
    riderStatus: 'Accepted', riderAssignedAt: new Date(), updatedAt: new Date(),
  }))
  await assertSucceeds(getDocs(query(collection(rider, 'serviceRequests'), where('riderUid', '==', 'rider-a'))))
  await assertSucceeds(updateDoc(doc(rider, 'serviceRequests/delivery-a'), { riderStatus: 'Picked up', updatedAt: new Date() }))
  await assertFails(updateDoc(doc(rider, 'serviceRequests/delivery-a'), { amount: 1, updatedAt: new Date() }))
  await assertSucceeds(updateDoc(doc(rider, 'serviceRequests/delivery-a'), {
    riderStatus: 'Delivered', status: 'Awaiting confirmation', currentStep: 4, deliveredAt: new Date(), completionRequestedBy: 'rider-a', completionRequestedAt: serverTimestamp(), updatedAt: new Date(),
  }))
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
test('new accounts cannot self-assign privileged worker roles', async () => {
  const provider = env.authenticatedContext('new-provider', { email: 'new@example.com' }).firestore()
  await assertFails(setDoc(doc(provider, 'users/new-provider'), {
    uid: 'new-provider', email: 'new@example.com', accountType: 'provider',
  }))
  await assertSucceeds(setDoc(doc(provider, 'users/new-provider'), {
    uid: 'new-provider', email: 'new@example.com', accountType: 'customer',
  }))
})
test('a customer cannot change role or payment state', async () => {
  await seed()
  const db = env.authenticatedContext('customer-a', verified).firestore()
  await assertFails(updateDoc(doc(db, 'users/customer-a'), { accountType: 'admin' }))
  await assertFails(updateDoc(doc(db, 'serviceRequests/order-a'), { paymentStatus: 'Paid' }))
})

test('signed-in customers can create bookings and pending provider applications', async () => {
  await seed()
  const db = env.authenticatedContext('customer-a', { email_verified: false, email: 'a@example.com' }).firestore()
  await assertSucceeds(setDoc(doc(db, 'serviceRequests/unverified-order'), baseOrder))
  await assertSucceeds(setDoc(doc(db, 'providerApplications/customer-a'), {
    userUid: 'customer-a', name: 'Customer A', email: 'a@example.com', phone: '+237670000001',
    role: 'provider', services: 'Cleaning', area: 'Douala', experience: 'Two years', status: 'Pending',
    identityVerified: false, payoutPhoneVerified: false,
  }))
  await assertFails(updateDoc(doc(db, 'users/customer-a'), { emailVerified: true }))
})

test('a verified customer cannot self-approve provider checks', async () => {
  await seed()
  const db = env.authenticatedContext('customer-a', { ...verified, email: 'a@example.com' }).firestore()
  const application = doc(db, 'providerApplications/customer-a')
  await assertSucceeds(setDoc(application, {
    userUid: 'customer-a', name: 'Customer A', email: 'a@example.com', phone: '+237670000001',
    role: 'provider', services: 'Cleaning', area: 'Douala', experience: 'Two years', status: 'Pending',
    identityVerified: false, payoutPhoneVerified: false,
  }))
  await assertFails(updateDoc(application, { identityVerified: true, payoutPhoneVerified: true }))
})

test('unassigned providers cannot browse or claim customer orders', async () => {
  await seed()
  const db = env.authenticatedContext('provider-a', { ...verified, email: 'p@example.com' }).firestore()
  await assertFails(getDocs(query(collection(db, 'serviceRequests'), where('status', '==', 'Pending'))))
  await assertFails(updateDoc(doc(db, 'serviceRequests/order-a'), {
    providerUid: 'provider-a', providerName: 'Provider A', providerEmail: 'p@example.com', providerPhone: '',
    status: 'Assigned', currentStep: 1, assignedAt: new Date(), updatedAt: new Date(),
  }))
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
    ...verifiedPayment, providerUid: 'provider-a', status: 'Out for Delivery', currentStep: 4,
  }))
  const order = doc(env.authenticatedContext('provider-a', verified).firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(order, {
    status: 'Awaiting confirmation', currentStep: 4, completionProofText: 'short', completionRequestedBy: 'provider-a', completionRequestedAt: serverTimestamp(), updatedAt: new Date(),
  }))
  await assertSucceeds(updateDoc(order, {
    status: 'Awaiting confirmation', currentStep: 4, completionProofText: 'Delivered to the customer.', completionRequestedBy: 'provider-a', completionRequestedAt: serverTimestamp(), updatedAt: new Date(),
  }))
  await assertFails(updateDoc(order, { payoutStatus: 'Paid' }))
})

test('a customer can submit a valid complaint but cannot forge its payout outcome', async () => {
  await seed()
  const order = doc(env.authenticatedContext('customer-a', { ...verified, email: 'a@example.com' }).firestore(), 'serviceRequests/order-a')
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

test('only the payment server can approve payments and admins can pay eligible payouts', async () => {
  await seed()
  const order = doc(env.authenticatedContext('admin-a').firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(order, { paymentStatus: 'Paid' }))
  await assertFails(updateDoc(order, { paymentStatus: 'Failed' }))
  await assertFails(updateDoc(order, { payoutStatus: 'Unknown' }))
  await assertFails(updateDoc(order, { payoutStatus: 'Paid' }))

  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), {
    ...verifiedPayment, status: 'Completed', currentStep: 5, completionConfirmedBy: 'customer-a', completionConfirmedAt: new Date(),
  }))
  await assertSucceeds(updateDoc(order, { payoutStatus: 'Paid' }))
})

test('customers cannot browse, modify, delete, or impersonate another customer', async () => {
  await seed()
  const db = env.authenticatedContext('customer-b', { email: 'b@example.com' }).firestore()
  await assertFails(getDoc(doc(db, 'users/customer-a')))
  await assertFails(getDocs(collection(db, 'users')))
  await assertFails(updateDoc(doc(db, 'users/customer-a'), { name: 'Forged' }))
  await assertFails(getDocs(collection(db, 'serviceRequests')))
  await assertFails(getDocs(query(collection(db, 'serviceRequests'), where('customerUid', '==', 'customer-a'))))
  await assertSucceeds(getDocs(query(collection(db, 'serviceRequests'), where('customerUid', '==', 'customer-b'))))
  await assertFails(updateDoc(doc(db, 'serviceRequests/order-a'), { customerNote: 'Forged' }))
  await assertFails(deleteDoc(doc(db, 'serviceRequests/order-a')))
  await assertFails(setDoc(doc(db, 'serviceRequests/forged-owner'), baseOrder))
})

test('a customer assigned as staff cannot read another customer order', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), { providerUid: 'customer-b', riderUid: 'customer-b' })
  })
  await assertFails(getDoc(doc(env.authenticatedContext('customer-b').firestore(), 'serviceRequests/order-a')))
})

test('customers cannot read another application or private payment records', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'providerApplications/customer-a'), { userUid: 'customer-a' })
    await setDoc(doc(context.firestore(), 'paymentSmsReceipts/receipt-a'), { customerUid: 'customer-a' })
  })
  const db = env.authenticatedContext('customer-b').firestore()
  await assertFails(getDoc(doc(db, 'providerApplications/customer-a')))
  await assertFails(getDoc(doc(db, 'paymentSmsReceipts/receipt-a')))
  await assertFails(getDoc(doc(db, 'paymentRateLimits/customer-a')))
})

async function seedCompletionClaim() {
  await seed()
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), {
    ...verifiedPayment, providerUid: 'provider-a', status: 'Awaiting confirmation', currentStep: 4,
    completionRequestedBy: 'provider-a', completionRequestedAt: new Date(),
  }))
}
function confirmation(uid = 'customer-a') {
  return { status: 'Completed', currentStep: 5, completionConfirmedBy: uid, completionConfirmedAt: serverTimestamp(), completedAt: serverTimestamp(), updatedAt: serverTimestamp() }
}

test('only the owning customer can confirm a completion claim, then payout becomes eligible', async () => {
  await seedCompletionClaim()
  for (const uid of ['provider-a', 'rider-a', 'customer-b', 'admin-a']) {
    await assertFails(updateDoc(doc(env.authenticatedContext(uid).firestore(), 'serviceRequests/order-a'), confirmation()))
  }
  const adminOrder = doc(env.authenticatedContext('admin-a').firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(adminOrder, { payoutStatus: 'Paid' }))
  await assertFails(updateDoc(adminOrder, { status: 'Completed', currentStep: 5, payoutStatus: 'Ready' }))
  await assertSucceeds(updateDoc(doc(env.authenticatedContext('customer-a').firestore(), 'serviceRequests/order-a'), confirmation()))
  await assertSucceeds(updateDoc(adminOrder, { payoutStatus: 'Paid' }))
})

test('workers cannot fabricate final completion or override a complaint', async () => {
  await seedCompletionClaim()
  const provider = doc(env.authenticatedContext('provider-a').firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(provider, { status: 'Completed', currentStep: 5, completedAt: serverTimestamp() }))
  const customer = doc(env.authenticatedContext('customer-a').firestore(), 'serviceRequests/order-a')
  await assertSucceeds(updateDoc(customer, {
    status: 'Complaint', currentStep: 2, payoutStatus: 'Held', complaintText: 'The delivery never arrived at my address.',
    complaintSubmittedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }))
  await assertFails(updateDoc(provider, { status: 'In Progress', currentStep: 2 }))
  await assertFails(updateDoc(customer, confirmation()))
  const adminOrder = doc(env.authenticatedContext('admin-a').firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(adminOrder, { payoutStatus: 'Paid' }))
})

test('customers cannot pre-confirm a new booking or confirm an unfinished booking', async () => {
  await seed()
  const customerDb = env.authenticatedContext('customer-a', { email: 'a@example.com' }).firestore()
  await assertFails(setDoc(doc(customerDb, 'serviceRequests/forged-confirmation'), {
    ...baseOrder, completionConfirmedBy: 'customer-a', completionConfirmedAt: serverTimestamp(),
  }))
  await assertFails(updateDoc(doc(customerDb, 'serviceRequests/order-a'), confirmation()))
})

test('a rider cannot directly finalize delivery or forge customer confirmation', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), {
    serviceType: 'delivery', riderUid: 'rider-a', status: 'Out for Delivery', currentStep: 4,
  }))
  const rider = doc(env.authenticatedContext('rider-a').firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(rider, { riderStatus: 'Delivered', status: 'Completed', currentStep: 5, deliveredAt: serverTimestamp() }))
  await assertFails(updateDoc(rider, confirmation()))
})


test('unpaid orders cannot advance through provider, rider, admin or customer actions', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), { providerUid: 'provider-a', status: 'Assigned', currentStep: 1 }))
  const provider = doc(env.authenticatedContext('provider-a').firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(provider, { status: 'In Progress', currentStep: 2, providerAcceptedBy: 'provider-a', providerAcceptedAt: serverTimestamp() }))
  const admin = doc(env.authenticatedContext('admin-a').firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(admin, { status: 'In Progress', currentStep: 2 }))
  for (const patch of [{ paymentInitiationState: 'Failed' }, { paymentReference: 'forged' }, { paymentVerifiedBy: 'fapshi-webhook' }, { paidAt: serverTimestamp() }]) {
    await assertFails(updateDoc(admin, patch))
  }
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), { status: 'Awaiting confirmation', currentStep: 4 }))
  await assertFails(updateDoc(doc(env.authenticatedContext('customer-a').firestore(), 'serviceRequests/order-a'), confirmation()))
})

test('paid provider work follows acceptance and ordered progress', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), { ...verifiedPayment, providerUid: 'provider-a', status: 'Assigned', currentStep: 1 }))
  const order = doc(env.authenticatedContext('provider-a').firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(order, { status: 'Quality Check', currentStep: 3 }))
  await assertFails(updateDoc(order, { status: 'In Progress', currentStep: 2 }))
  await assertSucceeds(updateDoc(order, { status: 'In Progress', currentStep: 2, providerAcceptedBy: 'provider-a', providerAcceptedAt: serverTimestamp() }))
  await assertFails(updateDoc(order, { status: 'Assigned', currentStep: 1 }))
  await assertSucceeds(updateDoc(order, { status: 'Quality Check', currentStep: 3 }))
  await assertSucceeds(updateDoc(order, { status: 'Awaiting confirmation', currentStep: 4, completionProofText: 'Cleaning completed and inspected.', completionRequestedBy: 'provider-a', completionRequestedAt: serverTimestamp() }))
  await assertSucceeds(updateDoc(doc(env.authenticatedContext('customer-a').firestore(), 'serviceRequests/order-a'), confirmation()))
})

test('manual rider assignment requires payment and delivery cannot skip pickup', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), { serviceType: 'delivery', status: 'Out for Delivery', currentStep: 4 }))
  const admin = doc(env.authenticatedContext('admin-a').firestore(), 'serviceRequests/order-a')
  const assignment = { riderUid: 'rider-a', riderStatus: 'Accepted', riderAssignedAt: serverTimestamp() }
  await assertFails(updateDoc(admin, assignment))
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), verifiedPayment))
  await assertSucceeds(updateDoc(admin, assignment))
  const rider = doc(env.authenticatedContext('rider-a').firestore(), 'serviceRequests/order-a')
  const delivered = { riderStatus: 'Delivered', status: 'Awaiting confirmation', currentStep: 4, deliveredAt: serverTimestamp(), completionRequestedBy: 'rider-a', completionRequestedAt: serverTimestamp() }
  await assertFails(updateDoc(rider, delivered))
  await assertSucceeds(updateDoc(rider, { riderStatus: 'Picked up' }))
  await assertFails(updateDoc(rider, { riderStatus: 'Accepted' }))
  await assertSucceeds(updateDoc(rider, delivered))
})

test('refund requests hold settlement without rewriting collection status', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), verifiedPayment))
  const order = doc(env.authenticatedContext('admin-a').firestore(), 'serviceRequests/order-a')
  await assertFails(updateDoc(order, { paymentStatus: 'Refunded' }))
  await assertSucceeds(updateDoc(order, { refundStatus: 'Requested', refundRequestedBy: 'admin-a', refundRequestedAt: serverTimestamp(), payoutStatus: 'Held' }))
  assert.equal((await getDoc(order)).data().paymentStatus, 'Paid')
})

test('customers cannot seed forged payment recovery or acceptance metadata', async () => {
  await seed()
  const db = env.authenticatedContext('customer-a', { email: 'a@example.com' }).firestore()
  for (const patch of [{ paymentInitiationState: 'Unknown', paymentInitiatedBy: 'customer-a' }, { paymentVerifiedAt: serverTimestamp() }, { providerAcceptedBy: 'provider-a' }, { paymentReference: 'tx-forged' }]) {
    await assertFails(setDoc(doc(db, 'serviceRequests/forged'), { ...baseOrder, ...patch }))
  }
})
