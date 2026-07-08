import { format, parseISO } from 'date-fns'
import type { PlannerEvent } from './db'

export function eventOccursOn(event: PlannerEvent, dateStr: string): boolean {
  const eventDate = event.date

  if (!event.endDate) {
    return eventDate === dateStr
  }

  if (dateStr < eventDate || dateStr > event.endDate) {
    return false
  }

  if (!event.recurrence || event.recurrence === 'nenhuma') {
    return eventDate === dateStr
  }

  const start = parseISO(eventDate)
  const check = parseISO(dateStr)
  const diffDays = Math.floor((check.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  switch (event.recurrence) {
    case 'diaria':
      return true
    case 'semanal':
      return diffDays % 7 === 0
    case 'mensal':
      return check.getDate() === start.getDate()
    case 'anual':
      return check.getDate() === start.getDate() && check.getMonth() === start.getMonth()
    default:
      return eventDate === dateStr
  }
}
