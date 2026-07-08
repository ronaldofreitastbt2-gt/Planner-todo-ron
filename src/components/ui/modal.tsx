import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
  /** When true, clicking the overlay does NOT close the modal */
  persistent?: boolean
  className?: string
}

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  persistent = false,
  className = '',
}: ModalProps) {
  const [visible, setVisible] = useState(false)
  const [animate, setAnimate] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Animate on mount, cleanup on unmount
  useEffect(() => {
    if (open) {
      setVisible(true)
      requestAnimationFrame(() => setAnimate(true))
    } else {
      setAnimate(false)
      const timer = setTimeout(() => setVisible(false), 200)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Lock body scroll when visible
  useEffect(() => {
    if (visible) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [visible])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !persistent) onOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, persistent, onOpenChange])

  if (!visible) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          animate ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => {
          if (!persistent) onOpenChange(false)
        }}
      />

      {/* Content */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl transition-all duration-200 ${
          animate ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        } ${className}`}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              onClick={() => onOpenChange(false)}
              className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {children}
      </div>
    </div>,
    document.body,
  )
}
