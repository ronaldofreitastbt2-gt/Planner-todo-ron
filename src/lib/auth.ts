import { getSheetsUrl } from './sheets-sync'

const SESSION_KEY = 'plannerUser'

export interface AuthUser {
  id: number
  email: string
  name: string
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function setCurrentUser(user: AuthUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export async function validateSession(): Promise<boolean> {
  const user = getCurrentUser()
  if (!user) return false

  const url = getSheetsUrl()
  if (!url) return false

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url + `?action=checkLogin&login=${encodeURIComponent(user.email)}`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const json = await res.json()
    return json.exists === true
  } catch {
    return false
  }
}
