import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebaseConfig'

const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
const maximumPhotoSize = 5 * 1024 * 1024
const maximumInlinePhotoSize = 700 * 1024
const photoMaxDimension = 720
const photoQuality = 0.72

function getPhotoUploadError(error) {
  if (error?.message === 'PHOTO_TOO_LARGE_FOR_PROFILE') {
    return new Error('This photo is still too large after compression. Please choose a smaller image.')
  }
  return error
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Choose a valid image file.'))
    }
    image.src = url
  })
}

async function createInlinePhoto(file) {
  const image = await loadImage(file)
  const scale = Math.min(1, photoMaxDimension / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  const photoURL = canvas.toDataURL('image/jpeg', photoQuality)
  if (photoURL.length > maximumInlinePhotoSize) {
    throw new Error('PHOTO_TOO_LARGE_FOR_PROFILE')
  }

  return photoURL
}

export async function uploadCustomerProfilePhoto(user, file) {
  if (!user?.uid) throw new Error('Please login again before uploading a photo.')
  if (!allowedImageTypes.includes(file?.type)) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size > maximumPhotoSize) throw new Error('Your profile photo must be smaller than 5 MB.')

  try {
    const photoURL = await createInlinePhoto(file)

    await updateDoc(doc(db, 'users', user.uid), {
      photoURL,
      photoStorageType: 'firestore-inline',
      updatedAt: serverTimestamp(),
    })

    return { photoURL, photoStorageType: 'firestore-inline' }
  } catch (error) {
    throw getPhotoUploadError(error)
  }
}

export async function uploadProviderBusinessPhoto(user, file) {
  if (!user?.uid) throw new Error('Please login again before uploading a photo.')
  if (!allowedImageTypes.includes(file?.type)) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size > maximumPhotoSize) throw new Error('Your business photo must be smaller than 5 MB.')

  try {
    const businessPhotoURL = await createInlinePhoto(file)

    await updateDoc(doc(db, 'users', user.uid), {
      businessPhotoURL,
      businessPhotoStorageType: 'firestore-inline',
      updatedAt: serverTimestamp(),
    })

    return { businessPhotoURL, businessPhotoStorageType: 'firestore-inline' }
  } catch (error) {
    throw getPhotoUploadError(error)
  }
}
