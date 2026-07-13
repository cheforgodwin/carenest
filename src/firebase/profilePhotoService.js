import { updateProfile } from 'firebase/auth'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from './firebaseConfig'

const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
const maximumPhotoSize = 5 * 1024 * 1024

export async function uploadCustomerProfilePhoto(user, file) {
  if (!user?.uid) throw new Error('Please login again before uploading a photo.')
  if (!allowedImageTypes.includes(file?.type)) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size > maximumPhotoSize) throw new Error('Your profile photo must be smaller than 5 MB.')

  const extension = file.type.split('/')[1].replace('jpeg', 'jpg')
  const storagePath = `profilePhotos/${user.uid}/profile-${Date.now()}.${extension}`
  const photoRef = ref(storage, storagePath)
  await uploadBytes(photoRef, file, { contentType: file.type })
  const photoURL = await getDownloadURL(photoRef)

  await Promise.all([
    updateProfile(auth.currentUser, { photoURL }),
    updateDoc(doc(db, 'users', user.uid), {
      photoURL,
      photoStoragePath: storagePath,
      updatedAt: serverTimestamp(),
    }),
  ])

  return { photoURL, photoStoragePath: storagePath }
}
