import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  MODE,
  configured,
  needsCode,
  ALLOWED_DOMAIN,
  getSession,
  onAuthChange,
  signInStart,
  signInVerify,
  signOut as storeSignOut
} from './store'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getSession().then((u) => {
      if (!active) return
      setUser(u)
      setLoading(false)
    })
    const unsub = onAuthChange((u) => setUser(u))
    return () => {
      active = false
      unsub()
    }
  }, [])

  const sendCode = useCallback(async (email) => {
    const res = await signInStart(email)
    if (res.user) setUser(res.user) // local mode signs in immediately
    return res
  }, [])

  const verifyCode = useCallback(async (email, token) => {
    const res = await signInVerify(email, token)
    if (res.user) setUser(res.user)
    return res
  }, [])

  const signOut = useCallback(async () => {
    await storeSignOut()
    setUser(null)
  }, [])

  const value = {
    mode: MODE,
    configured,
    needsCode,
    allowedDomain: ALLOWED_DOMAIN,
    loading,
    user,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    sendCode,
    verifyCode,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
