import {
  addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { marketplaceCategories, parseListingOptions } from '../config/marketplaceConfig'
import { db } from './firebaseConfig'

const listingsRef = collection(db, 'providerListings')

function normalizeListing(snapshot) {
  const data = snapshot.data()
  return {
    firestoreId: snapshot.id,
    ...data,
    createdAtDate: data.createdAt?.toDate?.() || null,
    updatedAtDate: data.updatedAt?.toDate?.() || null,
  }
}

function validateListing(listing) {
  if (!marketplaceCategories[listing.category]) throw new Error('Choose a supported category.')
  if (String(listing.title || '').trim().length < 3) throw new Error('Enter a listing title.')
  if (String(listing.description || '').trim().length < 10) throw new Error('Add a useful listing description.')
  if (!Number.isInteger(Number(listing.price)) || Number(listing.price) < 100) throw new Error('Price must be at least 100 FCFA.')
  if (!String(listing.serviceArea || '').trim()) throw new Error('Enter the area you serve.')
}

export function subscribeToActiveListings(onNext, onError) {
  return onSnapshot(
    query(listingsRef, where('active', '==', true)),
    (snapshot) => onNext(snapshot.docs.map(normalizeListing).sort((a, b) => String(a.title).localeCompare(String(b.title)))),
    onError,
  )
}

export function subscribeToProviderListings(providerUid, onNext, onError) {
  if (!providerUid) return () => {}
  return onSnapshot(
    query(listingsRef, where('providerUid', '==', providerUid)),
    (snapshot) => onNext(snapshot.docs.map(normalizeListing)),
    onError,
  )
}

export async function createProviderListing(provider, listing) {
  validateListing(listing)
  const category = marketplaceCategories[listing.category]
  return addDoc(listingsRef, {
    providerUid: provider.uid,
    providerName: provider.name || 'CareNest provider',
    providerPhone: provider.phone || '',
    title: String(listing.title).trim(),
    category: listing.category,
    kind: category.kind,
    description: String(listing.description).trim(),
    price: Number(listing.price),
    unit: String(listing.unit || category.unitLabel).trim(),
    serviceArea: String(listing.serviceArea).trim(),
    turnaround: String(listing.turnaround || '').trim(),
    options: parseListingOptions(listing.options),
    stockTracked: category.kind === 'product' && Boolean(listing.stockTracked),
    stockQuantity: category.kind === 'product' && listing.stockTracked ? Math.max(0, Number(listing.stockQuantity) || 0) : 0,
    active: Boolean(listing.active),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function updateProviderListing(listingId, updates) {
  const allowed = {
    title: String(updates.title || '').trim(),
    description: String(updates.description || '').trim(),
    price: Number(updates.price),
    unit: String(updates.unit || '').trim(),
    serviceArea: String(updates.serviceArea || '').trim(),
    turnaround: String(updates.turnaround || '').trim(),
    options: parseListingOptions(updates.options),
    stockTracked: Boolean(updates.stockTracked),
    stockQuantity: Math.max(0, Number(updates.stockQuantity) || 0),
    active: Boolean(updates.active),
  }
  validateListing({ ...updates, ...allowed })
  return updateDoc(doc(db, 'providerListings', listingId), { ...allowed, updatedAt: serverTimestamp() })
}

export function setProviderListingActive(listingId, active) {
  return updateDoc(doc(db, 'providerListings', listingId), { active: Boolean(active), updatedAt: serverTimestamp() })
}