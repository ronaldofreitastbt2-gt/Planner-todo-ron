'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { StickyNote, Pin } from 'lucide-react'
import { db, type Note } from '@/lib/db'
import { useAuth } from '@/hooks/use-auth'
import { useRegisterFab } from '@/hooks/use-fab'
import { PageHeader } from '@/components/planner/page-header'
import { NoteFormSheet } from '@/components/planner/note-form-sheet'

export default function NotasPage() {
  const [editing, setEditing] = useState<Note | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { user } = useAuth()
  const uid = user?.id?.toString() ?? ''

  const notes = useLiveQuery(
    () => uid ? db.notes.where('userId').equals(uid).sortBy('updatedAt').then((n) => n.reverse()) : [],
    [uid],
    [],
  )

  const pinned = (notes ?? []).filter((n) => n.pinned === 1)
  const unpinned = (notes ?? []).filter((n) => n.pinned === 0)

  function handleEdit(note: Note) {
    setEditing(note)
    setSheetOpen(true)
  }

  function handleNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  useRegisterFab(handleNew)

  return (
    <>
      <PageHeader title="Notas" />

      <div className="space-y-4 px-5 pb-6">
        {(notes ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <StickyNote className="size-7 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhuma nota</p>
            <p className="text-sm text-muted-foreground">
              Toque no + para criar uma nota
            </p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <Pin className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Fixadas
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {pinned.map((n) => (
                    <NoteCard
                      key={n.id}
                      note={n}
                      onClick={() => handleEdit(n)}
                    />
                  ))}
                </div>
              </div>
            )}

            {unpinned.length > 0 && (
              <div>
                {pinned.length > 0 && (
                  <span className="mb-2 block text-xs font-medium text-muted-foreground">
                    Outras
                  </span>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {unpinned.map((n) => (
                    <NoteCard
                      key={n.id}
                      note={n}
                      onClick={() => handleEdit(n)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <NoteFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        note={editing ?? undefined}
      />
    </>
  )
}

function NoteCard({ note, onClick }: { note: Note; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-2xl border border-border p-4 text-left transition-all active:scale-[0.97] hover:shadow-md"
      style={{ backgroundColor: note.color || undefined }}
    >
      {note.pinned === 1 && <Pin className="size-3 text-muted-foreground" />}
      {note.title && (
        <p className="line-clamp-2 text-sm font-semibold">{note.title}</p>
      )}
      {note.content && (
        <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
          {note.content}
        </p>
      )}
      <span className="mt-auto text-[10px] text-muted-foreground/60">
        {formatDistanceToNow(new Date(note.updatedAt), {
          addSuffix: true,
          locale: ptBR,
        })}
      </span>
    </button>
  )
}
