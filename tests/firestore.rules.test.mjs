import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

let env
const projectId = 'demo-carenest'
const baseOrder = {
  id: 'CN-TEST', customerUid: 'customer-a', customerEmail: 'a@example.com', customerPhone: '+237670000001',
  serviceType: 'laundry', serviceSpeed: 'Normal', itemSummary: 'Mixed clothes', amount: 3000,
  status: 'Pending', currentStep: 0, paymentMethod: 'Cash', paymentStatus: 'Pending',
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
  })
}

test('signed-out users cannot read orders', async () => {
  await seed()
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'serviceRequests/order-a')))
})

test('a customer can read only their own order', async () => {
  await seed()
  await assertSucceeds(getDoc(doc(env.authenticatedContext('customer-a').firestore(), 'serviceRequests/order-a')))
  await assertFails(getDoc(doc(env.authenticatedContext('customer-b').firestore(), 'serviceRequests/order-a')))
})

test('a customer cannot create a changed price', async () => {
  await seed()
  const db = env.authenticatedContext('customer-a').firestore()
  await assertFails(setDoc(doc(db, 'serviceRequests/bad-price'), { ...baseOrder, amount: 1 }))
  await assertSucceeds(setDoc(doc(db, 'serviceRequests/good-price'), baseOrder))
})

test('a customer cannot change role or payment state', async () => {
  await seed()
  const db = env.authenticatedContext('customer-a').firestore()
  await assertFails(updateDoc(doc(db, 'users/customer-a'), { accountType: 'admin' }))
  await assertFails(updateDoc(doc(db, 'serviceRequests/order-a'), { paymentStatus: 'Paid' }))
})

test('only one provider wins concurrent acceptance', async () => {
  await seed()
  const first = env.authenticatedContext('provider-a').firestore()
  await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), 'users/provider-b'), { uid: 'provider-b', accountType: 'provider' }))
  const second = env.authenticatedContext('provider-b').firestore()
  const accept = (db, uid) => updateDoc(doc(db, 'serviceRequests/order-a'), {
    providerUid: uid, providerName: uid, providerEmail: `${uid}@example.com`, providerPhone: '',
    status: 'Assigned', currentStep: 1, assignedAt: new Date(), updatedAt: new Date(),
  })
  const outcomes = await Promise.allSettled([accept(first, 'provider-a'), accept(second, 'provider-b')])
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1)
})

test('a provider cannot edit price or another provider job', async () => {
  await seed()
  const db = env.authenticatedContext('provider-a').firestore()
  await assertFails(updateDoc(doc(db, 'serviceRequests/order-a'), { amount: 9000 }))
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'serviceRequests/order-a'), { providerUid: 'provider-b', status: 'Assigned', currentStep: 1 }))
  await assertFails(updateDoc(doc(db, 'serviceRequests/order-a'), { status: 'In Progress', currentStep: 2, updatedAt: new Date() }))
})
