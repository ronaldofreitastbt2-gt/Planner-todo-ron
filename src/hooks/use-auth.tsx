import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import {
  type AuthUser,
  hashPassword,
  getCurrentUser,
  setCurrentUser,
  logout as clearSession,
} from '@/lib/auth'
import { getSheetsUrl } from '@/lib/sheets-sync'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getCurrentUser)
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (loginField: string, password: string) => {
    const url = getSheetsUrl()
    if (!url) return { success: false, error: 'Banco de dados não configurado' }

    setLoading(true)
    try {
      const passwordHash = await hashPassword(password)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const res = await fetch(url + `?action=login&login=${encodeURIComponent(loginField)}&passwordHash=${encodeURIComponent(passwordHash)}`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const json = await res.json()

      if (!json.success || !json.user) {
        return { success: false, error: json.error || 'Usuário ou senha incorretos' }
      }

      const authUser: AuthUser = {
        id: json.user.id,
        email: json.user.email,
        name: json.user.name,
      }
      setCurrentUser(authUser)
      setUser(authUser)
      return { success: true }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, error: 'Servidor demorou para responder. Tente novamente.' }
      }
      return { success: false, error: 'Erro na conexão com o servidor' }
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const url = getSheetsUrl()
    if (!url) return { success: false, error: 'Banco de dados não configurado' }

    setLoading(true)
    try {
      const passwordHash = await hashPassword(password)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const checkRes = await fetch(url + `?action=checkLogin&login=${encodeURIComponent(email)}`, {
        signal: controller.signal,
      })
      const checkJson = await checkRes.json()
      if (checkJson.exists) {
        clearTimeout(timeout)
        return { success: false, error: 'Este email já está cadastrado' }
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'register',
          data: { email, name, passwordHash, createdAt: new Date().toISOString() },
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const json = await res.json()

      if (!json.success) {
        return { success: false, error: json.error || 'Erro ao criar conta' }
      }

      const authUser: AuthUser = {
        id: json.userId,
        email,
        name,
      }
      setCurrentUser(authUser)
      setUser(authUser)
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Erro na conexão com o servidor' }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
