import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebaseConfig'

const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
const maximumPhotoSize = 5 * 1024 * 1024
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

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

async function createCompressedImageBlob(file) {
  const image = await loadImage(file)
  let scale = Math.min(1, photoMaxDimension / Math.max(image.width, image.height))
  let quality = photoQuality
  let width = Math.max(1, Math.round(image.width * scale))
  let height = Math.max(1, Math.round(image.height * scale))
  let lastSize = Infinity

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not process the selected image.')
    }
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    const blob = await canvasToBlob(canvas, quality)
    if (!blob) {
      throw new Error('Could not process the selected image.')
    }

    if (blob.size <= maximumPhotoSize) {
      return blob
    }

    if (blob.size >= lastSize) {
      break
    }
    lastSize = blob.size

    if (quality > 0.4) {
      quality = Math.max(0.4, quality - 0.1)
    } else {
      scale *= 0.85
      width = Math.max(1, Math.round(image.width * scale))
      height = Math.max(1, Math.round(image.height * scale))
    }
  }

  throw new Error('PHOTO_TOO_LARGE_FOR_PROFILE')
}

async function uploadImageToStorage(user, file, pathPrefix) {
  if (!user?.uid) throw new Error('Please login again before uploading a photo.')
  if (!allowedImageTypes.includes(file?.type)) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size > maximumPhotoSize) throw new Error('Your photo must be smaller than 5 MB.')

  const compressedBlob = await createCompressedImageBlob(file)
  const storageRef = ref(storage, `${pathPrefix}/${user.uid}-${Date.now()}.jpg`)
  await uploadBytes(storageRef, compressedBlob, { contentType: 'image/jpeg' })
  return getDownloadURL(storageRef)
}

export async function uploadCustomerProfilePhoto(user, file) {
  try {
    const photoURL = await uploadImageToStorage(user, file, 'profile-photos')

    await updateDoc(doc(db, 'users', user.uid), {
      photoURL,
      photoStorageType: 'storage',
      updatedAt: serverTimestamp(),
    })

    return { photoURL, photoStorageType: 'storage' }
  } catch (error) {
    throw getPhotoUploadError(error)
  }
}

export async function uploadProviderBusinessPhoto(user, file) {
  try {
    const businessPhotoURL = await uploadImageToStorage(user, file, 'business-photos')

    await updateDoc(doc(db, 'users', user.uid), {
      businessPhotoURL,
      businessPhotoStorageType: 'storage',
      updatedAt: serverTimestamp(),
    })

    return { businessPhotoURL, businessPhotoStorageType: 'storage' }
  } catch (error) {
    throw getPhotoUploadError(error)
  }
}
