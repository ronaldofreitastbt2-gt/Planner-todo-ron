/**
 * Cloud Sync Layer
 *
 * Pushes local IndexedDB changes to the cloud database via Apps Script Web App.
 * Reads from cloud on demand (import/sync).
 *
 * Works alongside Dexie — local-first, cloud as mirror.
 */

import { db } from './db'
import { type Task, type PlannerEvent, type Habit, type HabitLog, type Note, type AppSettings } from './db'
import { getCurrentUser } from './auth'

const SETTINGS_KEY = 'sheetsApiUrl'

const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxINeDeIukAyk5U_Et-j07CpcaDxFMHk_KvFvjQmiOdiidrWNn0Rw2TRltLb10Hw_Me/exec'

export function getSheetsUrl(): string {
  return localStorage.getItem(SETTINGS_KEY) || DEFAULT_SHEETS_URL
}

export function setSheetsUrl(url: string) {
  localStorage.setItem(SETTINGS_KEY, url)
}

export function isSheetsConfigured(): boolean {
  return !!getSheetsUrl()
}

function getUserId(): string {
  return getCurrentUser()?.id?.toString() ?? ''
}

type EntityName = 'tasks' | 'events' | 'habits' | 'habitLogs' | 'notes' | 'settings'

/** Upsert a single entity to Sheets. Returns false if sync was skipped (URL not configured). */
async function upsertEntity(entity: EntityName, data: Record<string, any>): Promise<boolean> {
  const url = getSheetsUrl()
  if (!url) return false

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'upsert', entity, data, userId: getUserId() }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return true
  } catch {
    return false
  }
}

/** Delete a single entity from Sheets. Returns false if sync was skipped (URL not configured). */
async function deleteEntity(entity: EntityName, id: number): Promise<boolean> {
  const url = getSheetsUrl()
  if (!url) return false

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'delete', entity, id, userId: getUserId() }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return true
  } catch {
    return false
  }
}

// ====== Public API — called after local DB writes ======

export async function syncTaskUpsert(task: Task): Promise<boolean> {
  return upsertEntity('tasks', task)
}

export async function syncTaskDelete(id: number): Promise<boolean> {
  return deleteEntity('tasks', id)
}

export async function syncEventUpsert(event: PlannerEvent): Promise<boolean> {
  return upsertEntity('events', event)
}

export async function syncEventDelete(id: number): Promise<boolean> {
  return deleteEntity('events', id)
}

export async function syncHabitUpsert(habit: Habit): Promise<boolean> {
  return upsertEntity('habits', habit)
}

export async function syncHabitDelete(id: number): Promise<boolean> {
  return deleteEntity('habits', id)
}

export async function syncHabitLogUpsert(log: HabitLog): Promise<boolean> {
  return upsertEntity('habitLogs', log)
}

export async function syncHabitLogDelete(id: number): Promise<boolean> {
  return deleteEntity('habitLogs', id)
}

export async function syncNoteUpsert(note: Note): Promise<boolean> {
  return upsertEntity('notes', note)
}

export async function syncNoteDelete(id: number): Promise<boolean> {
  return deleteEntity('notes', id)
}

export async function syncSettings(settings: AppSettings): Promise<boolean> {
  const data = { ...settings }
  if (data.bgImageDataUrl && data.bgImageDataUrl.length > 30000) {
    data.bgImageDataUrl = ''
  }
  return upsertEntity('settings', data)
}

/** Full sync — push all local data to Sheets (replaces remote) */
export async function fullSyncToSheets(): Promise<{ success: boolean; error?: string }> {
  const url = getSheetsUrl()
  if (!url) return { success: false, error: 'URL não configurada' }

  const userId = getUserId()
  if (!userId) return { success: false, error: 'Usuário não autenticado' }

  try {
    const allTasks = await db.tasks.toArray()
    const allEvents = await db.events.toArray()
    const allHabits = await db.habits.toArray()
    const allHabitLogs = await db.habitLogs.toArray()
    const allNotes = await db.notes.toArray()
    const rawSettings = await db.settings.toArray()

    const settings = rawSettings.map((s) => ({
        id: s.id || 1,
        userId,
        theme: s.theme || '',
        dark: s.dark || false,
        bgType: s.bgType || 'color',
        bgColor: s.bgColor || '',
        bgSvgPreset: s.bgSvgPreset || 'waves',
        bgImageDataUrl: s.bgImageDataUrl && s.bgImageDataUrl.length <= 30000 ? s.bgImageDataUrl : '',
        bgOverlayOpacity: s.bgOverlayOpacity || 0,
        bgOverlayBlur: s.bgOverlayBlur || 0,
        notificationSound: s.notificationSound || '',
        taskSound: s.taskSound || '',
        eventSound: s.eventSound || '',
        habitSound: s.habitSound || '',
        notificationVibrate: s.notificationVibrate ?? true,
        notificationPush: s.notificationPush ?? false,
        alarmMinutesBefore: s.alarmMinutesBefore || 5,
      }))

    const data = {
      tasks: allTasks.map((t) => ({ ...t, userId })),
      events: allEvents.map((e) => ({ ...e, userId })),
      habits: allHabits.map((h) => ({ ...h, userId })),
      habitLogs: allHabitLogs.map((l) => ({ ...l, userId })),
      notes: allNotes.map((n) => ({ ...n, userId })),
      settings,
    }

    const bodyStr = JSON.stringify({ action: 'sync', data, userId })
    console.log('[sync] Tamanho do payload:', Math.round(bodyStr.length / 1024), 'KB')
    console.log('[sync] bgImageDataUrl length:', settings[0]?.bgImageDataUrl?.length || 0)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: bodyStr,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const json = await res.json()
    console.log('[sync] Resposta:', json)
    return { success: json.success, error: json.error }
  } catch (err: any) {
    console.error('[sync] Erro:', err)
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Servidor demorou para responder (30s timeout)' }
    }
    return { success: false, error: String(err) }
  }
}

/** Import all data from Sheets → local IndexedDB */
export async function importFromSheets(): Promise<{ success: boolean; error?: string; counts?: Record<string, number>; changed?: boolean }> {
  const url = getSheetsUrl()
  if (!url) return { success: false, error: 'URL não configurada' }

  const userId = getUserId()
  if (!userId) return { success: false, error: 'Usuário não autenticado' }

  try {
    let res = await fetch(url + `?action=list&userId=${encodeURIComponent(userId)}`)
    let json = await res.json()

    if (!json.success) return { success: false, error: json.error }

    let data = json.data
    const hasAnyData = Object.keys(data).some(
      (k) => k !== 'users' && data[k] && data[k].length > 0,
    )

    if (!hasAnyData) {
      res = await fetch(url + '?action=list&claim=1')
      json = await res.json()
      if (!json.success) return { success: false, error: json.error }
      data = json.data
    }

    const counts: Record<string, number> = {}
    let changed = false

    // Merge que preserva dados locais que não existem no remoto
    // (resolve o problema da planilha sem colunas de alarme, etc.)
    async function mergeEntity<T extends { id?: number }>(
      entity: 'tasks' | 'events' | 'habits' | 'habitLogs' | 'notes',
      remote: T[],
    ): Promise<T[]> {
      const table = db[entity] as any
      const existing = await table.where('userId').equals(userId).toArray()
      const existingMap = new Map<number, T>()
      existing.forEach((r: T) => {
        if (r.id != null) existingMap.set(r.id as number, r)
      })
      // Para cada item remoto, preserva campos locais ausentes no remoto
      return remote.map((r) => {
        if (r.id == null) return { ...r, userId }
        const local = existingMap.get(r.id as number)
        if (!local) return { ...r, userId }
        // Faz merge: campos remotos faltantes/orfan ficam com valor local
        const merged: any = { ...local, ...r }
        // Garante que campo remoto undefined não sobrescreva local válido
        Object.keys(local as any).forEach((k) => {
          if (merged[k] === undefined && (local as any)[k] !== undefined) {
            merged[k] = (local as any)[k]
          }
        })
        merged.userId = userId
        return merged as T
      })
    }

    if (data.tasks && data.tasks.length > 0) {
      const items = await mergeEntity<Task>('tasks', data.tasks)
      await db.tasks.where('userId').equals(userId).delete()
      await db.tasks.bulkPut(items)
      counts.tasks = items.length
      changed = true
    }
    if (data.events && data.events.length > 0) {
      const items = await mergeEntity<PlannerEvent>('events', data.events)
      await db.events.where('userId').equals(userId).delete()
      await db.events.bulkPut(items)
      counts.events = items.length
      changed = true
    }
    if (data.habits && data.habits.length > 0) {
      const items = await mergeEntity<Habit>('habits', data.habits)
      await db.habits.where('userId').equals(userId).delete()
      await db.habits.bulkPut(items)
      counts.habits = items.length
      changed = true
    }
    if (data.habitLogs && data.habitLogs.length > 0) {
      const items = await mergeEntity<HabitLog>('habitLogs', data.habitLogs)
      await db.habitLogs.where('userId').equals(userId).delete()
      await db.habitLogs.bulkPut(items)
      counts.habitLogs = items.length
      changed = true
    }
    if (data.notes && data.notes.length > 0) {
      const items = await mergeEntity<Note>('notes', data.notes)
      await db.notes.where('userId').equals(userId).delete()
      await db.notes.bulkPut(items)
      counts.notes = items.length
      changed = true
    }
    if (data.settings && data.settings.length > 0) {
      const existingSettings = await db.settings.where('userId').equals(userId).first()
      const remoteImg = data.settings[0].bgImageDataUrl || ''
      const localImg = existingSettings?.bgImageDataUrl || ''
      const settingsWithUser = {
        ...data.settings[0],
        userId,
        bgImageDataUrl: remoteImg || localImg,
      }
      await db.settings.put(settingsWithUser)
      counts.settings = 1
      changed = true
    }

    return { success: true, counts, changed }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/** Test connection to Apps Script Web App */
export async function testSheetsConnection(): Promise<{ success: boolean; error?: string }> {
  const url = getSheetsUrl()
  if (!url) return { success: false, error: 'URL não configurada' }

  try {
    const res = await fetch(url + '?action=list&entity=settings')
    const json = await res.json()
    return { success: !!json.success }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/** Delete user account and all data from the cloud database */
export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
  const url = getSheetsUrl()
  if (!url) return { success: false, error: 'URL não configurada' }

  const userId = getUserId()
  if (!userId) return { success: false, error: 'Usuário não autenticado' }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'deleteAccount', userId }),
    })
    const json = await res.json()
    return { success: !!json.success, error: json.error }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
