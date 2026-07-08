import Dexie, { type EntityTable } from 'dexie'

export interface User {
  id?: number
  email: string
  name: string
  passwordHash: string
  createdAt: string
}

export interface Task {
  id?: number
  userId: string
  title: string
  description?: string
  priority: 'baixa' | 'media' | 'alta'
  dueDate?: string
  dueTime?: string
  completed: number
  createdAt: string
  alarmEnabled: number
  alarmMinutesBefore: number
  alarmSound: string
}

export interface PlannerEvent {
  id?: number
  userId: string
  title: string
  description?: string
  date: string
  endDate?: string
  startTime?: string
  endTime?: string
  color: string
  recurrence?: string
  alarmEnabled: number
  alarmMinutesBefore: number
  alarmSound: string
}

export interface Habit {
  id?: number
  userId: string
  name: string
  icon: string
  daysOfWeek: number[]
  createdAt: string
}

export interface HabitLog {
  id?: number
  userId: string
  habitId: number
  date: string
}

export interface Note {
  id?: number
  userId: string
  title: string
  content: string
  color?: string
  pinned: number
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  id: number // always 1 (singleton per user)
  userId: string
  theme: string
  dark: boolean
  bgType: 'color' | 'svg' | 'image' | 'gif'
  bgColor: string
  bgSvgPreset: string
  bgImageDataUrl: string
  bgOverlayOpacity: number
  bgOverlayBlur: number
  notificationSound: string
  taskSound: string
  eventSound: string
  habitSound: string
  notificationVibrate: boolean
  notificationPush: boolean
  alarmMinutesBefore: number
}

export const db = new Dexie('PlannerDB') as Dexie & {
  users: EntityTable<User, 'id'>
  tasks: EntityTable<Task, 'id'>
  events: EntityTable<PlannerEvent, 'id'>
  habits: EntityTable<Habit, 'id'>
  habitLogs: EntityTable<HabitLog, 'id'>
  notes: EntityTable<Note, 'id'>
  settings: EntityTable<AppSettings, 'id'>
}

db.version(1).stores({
  tasks: '++id, title, priority, dueDate, completed, createdAt',
  events: '++id, title, date, color',
  habits: '++id, name, createdAt',
  habitLogs: '++id, habitId, date, [habitId+date]',
  notes: '++id, title, pinned, updatedAt',
  settings: 'id',
})

db.version(2).stores({
  users: '++id, &email',
  tasks: '++id, userId, title, priority, dueDate, completed, createdAt',
  events: '++id, userId, title, date, color',
  habits: '++id, userId, name, createdAt',
  habitLogs: '++id, userId, habitId, date, [habitId+date]',
  notes: '++id, userId, title, pinned, updatedAt',
  settings: 'id, userId',
}).upgrade(async (tx) => {
  const userId = '1'
  await tx.table('tasks').toCollection().modify({ userId })
  await tx.table('events').toCollection().modify({ userId })
  await tx.table('habits').toCollection().modify({ userId })
  await tx.table('habitLogs').toCollection().modify({ userId })
  await tx.table('notes').toCollection().modify({ userId })
  await tx.table('settings').toCollection().modify({ userId })
})
