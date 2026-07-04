import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/firebaseConfig'
import { getUserProfile, logout } from '../firebase/authService'
import { AuthContext } from './authStore'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  function setSession(nextProfile) {
    setUser(auth.currentUser)
    setProfile(nextProfile)
    setLoading(false)
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (!firebaseUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        setProfile(await getUserProfile(firebaseUser.uid))
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    logout,
    setSession,
  }), [user, profile, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
