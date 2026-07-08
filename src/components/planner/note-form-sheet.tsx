import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/hooks/use-auth'
import { db, type Note } from '@/lib/db'
import { syncNoteUpsert, syncNoteDelete } from '@/lib/sheets-sync'

const COLORS = ['', '#fef3c7', '#dbeafe', '#f3e8ff', '#fce7f3', '#d1fae5', '#ffe4e6']

export function NoteFormSheet({
  open,
  onOpenChange,
  note,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  note?: Note
}) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [color, setColor] = useState('')
  const [pinned, setPinned] = useState(0)

  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setContent(note.content)
      setColor(note.color ?? '')
      setPinned(note.pinned)
    } else {
      setTitle('')
      setContent('')
      setColor('')
      setPinned(0)
    }
  }, [note, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const now = new Date().toISOString()
      const data = {
        userId: user!.id.toString(),
        title: title.trim() || 'Sem título',
        content: content.trim(),
        color: color || undefined,
        pinned,
        updatedAt: now,
      }

      if (note?.id) {
        const existing = await db.notes.get(note.id)
        if (existing) {
          await db.notes.update(note.id, data)
        } else {
          await db.notes.put({ ...data, id: note.id, createdAt: note.createdAt ?? now })
        }
        await syncNoteUpsert({ ...note, ...data })
        toast('success', 'Nota atualizada')
      } else {
        const id = await db.notes.add({ ...data, createdAt: now })
        await syncNoteUpsert({ id: Number(id), ...data, createdAt: now } as Note)
        toast('success', 'Nota criada')
      }

      onOpenChange(false)
    } catch (err) {
      console.error('[note] Erro ao salvar nota:', err)
      toast('error', `Erro ao salvar: ${err}`)
    }
  }

  async function handleDelete() {
    if (note?.id) {
      await db.notes.delete(note.id)
      await syncNoteDelete(note.id)
      toast('info', 'Nota excluída')
      onOpenChange(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={note ? 'Editar nota' : 'Nova nota'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Título (opcional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />

            <textarea
              placeholder="Conteúdo da nota"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Cor</p>
              <div className="flex gap-2">
                {COLORS.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`size-8 rounded-full border-2 transition-all ${
                      color === c ? 'border-primary' : 'border-border'
                    }`}
                    style={{ backgroundColor: c || '#f8f8f8' }}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPinned(pinned === 1 ? 0 : 1)}
              className={`w-full rounded-xl py-2.5 text-sm font-medium transition-all ${
                pinned ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {pinned ? 'Fixada' : 'Fixar nota'}
            </button>

            <div className="flex gap-2">
              {note?.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-xl border border-destructive/30 py-3 px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  Excluir
                </button>
              )}
              <button
                type="submit"
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98]"
              >
                {note ? 'Salvar' : 'Criar nota'}
              </button>
            </div>
      </form>
    </Modal>
  )
}
