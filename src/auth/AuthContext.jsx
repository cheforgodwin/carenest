import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth } from '../firebase/firebaseConfig'
import { db } from '../firebase/firebaseConfig'
import { logout } from '../firebase/authService'
import { AuthContext } from './authStore'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function setSession(nextProfile) {
    setUser(auth.currentUser)
    setProfile(nextProfile)
    setLoading(false)
  }

  useEffect(() => {
    let unsubscribeProfile = () => {}

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeProfile()
      setUser(firebaseUser)
      if (!firebaseUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      setLoading(true)
      unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (snapshot) => {
        setProfile(snapshot.exists() ? snapshot.data() : null)
        setError('')
        setLoading(false)
      }, () => {
        setProfile(null)
        setError('We could not load your account. Check your connection and try again.')
        setLoading(false)
      })
    })

    return () => {
      unsubscribeProfile()
      unsubscribeAuth()
    }
  }, [])

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    error,
    logout,
    setSession,
  }), [user, profile, loading, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
