import { Volume2 } from 'lucide-react'
import { Modal } from './modal'

export type SoundPreset = {
  id: string
  name: string
  description: string
  play: () => void
}

interface SoundPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  presets: SoundPreset[]
  selected: string
  onSelect: (id: string) => void
}

export function SoundPickerModal({
  open,
  onOpenChange,
  title,
  presets,
  selected,
  onSelect,
}: SoundPickerModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title}>
      <div className="space-y-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => {
              onSelect(preset.id)
              onOpenChange(false)
            }}
            className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all ${
              selected === preset.id
                ? 'bg-primary/10 ring-2 ring-primary'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
              selected === preset.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              <Volume2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{preset.name}</p>
              <p className="text-xs text-muted-foreground">{preset.description}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                preset.play()
              }}
              className="shrink-0 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Ouvir
            </button>
          </button>
        ))}
      </div>
    </Modal>
  )
}
