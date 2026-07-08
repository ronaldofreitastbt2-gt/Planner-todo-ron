import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

/* ====== Types ====== */

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
  exiting?: boolean
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void
}

/* ====== Config ====== */

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const BORDERS: Record<ToastType, string> = {
  success: 'border-l-success',
  error: 'border-l-destructive',
  warning: 'border-l-warning',
  info: 'border-l-primary',
}

const ICON_COLORS: Record<ToastType, string> = {
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-primary',
}

/* ====== Context ====== */

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 300)
  }, [])

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = ++nextId
      setToasts((prev) => [...prev.slice(-4), { id, type, message }])
      setTimeout(() => removeToast(id), 3500)
    },
    [removeToast],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.type]
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-lg border-l-4 transition-all duration-300 ${
                BORDERS[t.type]
              } ${
                t.exiting
                  ? 'opacity-0 translate-x-4 scale-95'
                  : 'opacity-100 translate-x-0 scale-100'
              } animate-in slide-in-from-right`}
            >
              <Icon className={`size-5 shrink-0 mt-0.5 ${ICON_COLORS[t.type]}`} />
              <p className="flex-1 text-sm">{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
