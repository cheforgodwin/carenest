import { EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth'
import { auth } from './firebaseConfig'
import { postJson } from '../utils/networkUtils'

export async function deleteOwnAccount(user, password, confirmation) {
  if (!user || user.uid !== auth.currentUser?.uid) throw new Error('Sign in again before deleting your account.')
  if (confirmation !== 'DELETE') throw new Error('Type DELETE to confirm.')
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
  await user.getIdToken(true)
  if (auth.currentUser?.uid !== user.uid) throw new Error('Your account changed. Please try again.')
  await postJson('/api/account', { action: 'delete', confirmation, accountUid: user.uid }, { timeoutMs: 60000 })
  await signOut(auth)
}
