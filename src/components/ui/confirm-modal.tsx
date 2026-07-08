import { AlertTriangle } from 'lucide-react'
import { Modal } from './modal'

interface ConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  danger?: boolean
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = 'Confirmar',
  onConfirm,
  danger = false,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} persistent>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className={`flex size-14 items-center justify-center rounded-full ${danger ? 'bg-destructive/10' : 'bg-warning/10'}`}>
          <AlertTriangle className={`size-7 ${danger ? 'text-destructive' : 'text-warning'}`} />
        </div>

        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>

        <div className="flex w-full gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl bg-secondary py-3 text-sm font-medium text-secondary-foreground transition-all active:scale-[0.98]"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] ${
              danger ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
