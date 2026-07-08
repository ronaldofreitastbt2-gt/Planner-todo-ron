import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { validateSession } from '@/lib/auth'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const [checking, setChecking] = useState(true)
  const [valid, setValid] = useState(false)

  useEffect(() => {
    if (!user) {
      setChecking(false)
      setValid(false)
      return
    }

    validateSession().then((ok) => {
      if (!ok) {
        logout()
        setValid(false)
      } else {
        setValid(true)
      }
      setChecking(false)
    })
  }, [])

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user || !valid) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
