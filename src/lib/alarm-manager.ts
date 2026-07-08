import { db } from './db'
import { getCurrentUser } from './auth'

let alarmCheckInterval: ReturnType<typeof setInterval> | null = null
let audioCtx: AudioContext | null = null
const FIRED_KEY = 'planner_fired_alarms'

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

// ====== Fired alarm tracking ======

function getFiredAlarms(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    if (!raw) return new Set()
    const arr: [string, number][] = JSON.parse(raw)
    const now = Date.now()
    // Limpar registros mais antigos que 48h
    const recent = arr.filter(([, t]) => now - t < 48 * 60 * 60 * 1000)
    localStorage.setItem(FIRED_KEY, JSON.stringify(recent))
    return new Set(recent.map(([k]) => k))
  } catch {
    return new Set()
  }
}

function markFired(alarmKey: string) {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    const arr: [string, number][] = raw ? JSON.parse(raw) : []
    arr.push([alarmKey, Date.now()])
    // Manter apenas últimos 48h
    const now = Date.now()
    const recent = arr.filter(([, t]) => now - t < 48 * 60 * 60 * 1000)
    localStorage.setItem(FIRED_KEY, JSON.stringify(recent))
  } catch {
    // ignore
  }
}

function makeAlarmKey(type: string, id: number, date: string, time: string): string {
  return `${type}:${id}:${date}:${time}`
}

// ====== Core ======

export function startAlarmManager() {
  if (alarmCheckInterval) return

  console.log('[alarm] Alarm manager iniciado')

  // Check imediato ao abrir (pega alarmes perdidos enquanto app estava fechado)
  checkAlarms(true)

  // Intervalo para quando o app estiver em foreground
  alarmCheckInterval = setInterval(() => checkAlarms(false), 30_000)

  // Quando o app volta ao foreground, check imediato
  document.addEventListener('visibilitychange', onVisibilityChange)

  // Desbloqueia AudioContext no primeiro gesto
  unlockAudioOnUserGesture()
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    console.log('[alarm] App voltou ao foreground — verificando alarmes perdidos')
    checkAlarms(true)
  }
}

function unlockAudioOnUserGesture() {
  const unlock = () => {
    try {
      const ctx = getAudioContext()
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
    } catch {
      // ignore
    }
    document.removeEventListener('touchstart', unlock)
    document.removeEventListener('click', unlock)
  }
  document.addEventListener('touchstart', unlock, { once: true, passive: true })
  document.addEventListener('click', unlock, { once: true, passive: true })
}

export function stopAlarmManager() {
  if (alarmCheckInterval) {
    clearInterval(alarmCheckInterval)
    alarmCheckInterval = null
  }
  document.removeEventListener('visibilitychange', onVisibilityChange)
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

/**
 * Verifica alarmes pendentes.
 * @param checkMissed — se true, olha alarmes das últimas 24h (app voltou ao foreground)
 *                        se false, olha apenas janela de 65s (intervalo normal)
 */
async function checkAlarms(checkMissed: boolean) {
  const user = getCurrentUser()
  if (!user) return

  const uid = user.id.toString()
  const now = new Date()
  const fired = getFiredAlarms()

  // Buscar tarefas com alarme ativo e não concluídas
  const tasks = await db.tasks
    .where('userId')
    .equals(uid)
    .filter((t) => t.completed === 0 && t.alarmEnabled === 1 && !!t.dueDate && !!t.dueTime)
    .toArray()

  for (const task of tasks) {
    const taskDateTime = new Date(`${task.dueDate}T${task.dueTime}`)
    const alarmTime = new Date(taskDateTime.getTime() - task.alarmMinutesBefore * 60_000)
    const diff = alarmTime.getTime() - now.getTime()
    const key = makeAlarmKey('task', task.id!, task.dueDate!, task.dueTime!)

    if (fired.has(key)) continue // Já disparou, pular

    // Janela de disparo:
    // - checkMissed: alarme deveria ter disparado nas últimas 24h e ainda não passou de 1h do horário
    // - check normal: janela de 65s
    let shouldFire = false
    if (checkMissed) {
      // Alarme deveria ter disparado: agora - 24h < alarmTime < agora + 2min
      // E o horário da tarefa ainda não passou há mais de 1h (para não disparar tarefas muito antigas)
      const taskPastDeadline = now.getTime() - taskDateTime.getTime() > 60 * 60 * 1000
      if (diff >= -60 * 60 * 1000 && diff < 2 * 60 * 1000 && !taskPastDeadline) {
        shouldFire = true
      }
    } else {
      // Janela normal de 65s
      if (diff >= -5000 && diff < 65_000) {
        shouldFire = true
      }
    }

    if (shouldFire) {
      console.log(`[alarm] DISPARANDO tarefa: ${task.title}, key: ${key}`)
      markFired(key)
      triggerAlarm(
        `Tarefa: ${task.title}`,
        task.description ? `${task.description} — Prazo: ${task.dueDate} ${task.dueTime}` : `Prazo: ${task.dueDate} ${task.dueTime}`,
        'task',
      )
    }
  }

  // Mesma lógica para eventos
  const events = await db.events
    .where('userId')
    .equals(uid)
    .filter((e) => e.alarmEnabled === 1 && !!e.startTime)
    .toArray()

  for (const event of events) {
    const eventDateTime = new Date(`${event.date}T${event.startTime}`)
    const alarmTime = new Date(eventDateTime.getTime() - event.alarmMinutesBefore * 60_000)
    const diff = alarmTime.getTime() - now.getTime()
    const key = makeAlarmKey('event', event.id!, event.date, event.startTime!)

    if (fired.has(key)) continue

    let shouldFire = false
    if (checkMissed) {
      const eventPastDeadline = now.getTime() - eventDateTime.getTime() > 60 * 60 * 1000
      if (diff >= -60 * 60 * 1000 && diff < 2 * 60 * 1000 && !eventPastDeadline) {
        shouldFire = true
      }
    } else {
      if (diff >= -5000 && diff < 65_000) {
        shouldFire = true
      }
    }

    if (shouldFire) {
      console.log(`[alarm] DISPARANDO evento: ${event.title}, key: ${key}`)
      markFired(key)
      triggerAlarm(
        `Evento: ${event.title}`,
        event.startTime && event.endTime
          ? `${event.date} ${event.startTime} - ${event.endTime}`
          : `${event.date} ${event.startTime ?? ''}`,
        'event',
      )
    }
  }
}

type AlarmType = 'task' | 'event' | 'habit'

async function triggerAlarm(title: string, body: string, type: AlarmType) {
  console.log(`[alarm] triggerAlarm: ${title}, type: ${type}`)

  const user = getCurrentUser()
  const uid = user?.id?.toString() ?? ''
  const settings = uid ? await db.settings.where('userId').equals(uid).first() : undefined

  const soundMap: Record<AlarmType, string | undefined> = {
    task: settings?.taskSound || settings?.notificationSound || '',
    event: settings?.eventSound || settings?.notificationSound || '',
    habit: settings?.habitSound || settings?.notificationSound || '',
  }
  const soundUrl = soundMap[type]
  const vibrate = settings?.notificationVibrate ?? true
  const pushEnabled =
    (settings?.notificationPush ?? false) &&
    'Notification' in window &&
    Notification.permission === 'granted'

  console.log(`[alarm] settings: push=${pushEnabled}, vibrate=${vibrate}, sound=${soundUrl ? 'custom' : 'default'}`)

  // Tocar som
  playSound(soundUrl ?? '', type)

  // Vibração
  if (vibrate && navigator.vibrate) {
    navigator.vibrate([300, 200, 300, 200, 500])
    console.log('[alarm] Vibração disparada')
  }

  // Notificação push (só funciona em foreground no PWA sem backend de push)
  if (pushEnabled) {
    showNotification(title, body, vibrate)
  } else {
    console.log('[alarm] Push desativado ou sem permissão')
  }
}

function playSound(soundUrl: string, type: AlarmType) {
  if (!soundUrl) {
    playDefaultBeep(type)
    return
  }

  const preset = SOUND_PRESETS[type]?.find((p) => p.id === soundUrl)
  if (preset) {
    playFrequencies(preset.frequencies)
    return
  }

  try {
    const audio = new Audio(soundUrl)
    audio.play().catch(() => playDefaultBeep(type))
  } catch {
    playDefaultBeep(type)
  }
}

function playDefaultBeep(type: AlarmType) {
  const freqMap: Record<AlarmType, [number, number]> = {
    task: [523, 659],
    event: [440, 554],
    habit: [587, 740],
  }

  const [freq1, freq2] = freqMap[type]

  try {
    const ctx = getAudioContext()

    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.frequency.value = freq1
    osc1.type = 'sine'
    gain1.gain.setValueAtTime(0.3, ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc1.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 0.3)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.frequency.value = freq2
    osc2.type = 'sine'
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.2)
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    osc2.start(ctx.currentTime + 0.2)
    osc2.stop(ctx.currentTime + 0.5)
  } catch {
    // AudioContext not available
  }
}

async function showNotification(title: string, body: string, vibrate: boolean) {
  console.log(`[alarm] showNotification: ${title}, SW: ${!!navigator.serviceWorker?.controller}`)

  if ('serviceWorker' in navigator) {
    try {
      let reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js')
      }

      if (reg) {
        if (reg.installing) {
          console.log('[alarm] SW instalando, aguardando...')
          await new Promise<void>((resolve) => {
            reg!.installing!.addEventListener('statechange', (e) => {
              if ((e.target as ServiceWorker).state === 'activated') resolve()
            })
            setTimeout(resolve, 5000)
          })
        }

        console.log('[alarm] Enviando notificação via SW')
        const notifOptions: NotificationOptions & { vibrate?: number[] } = {
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          tag: `planner-${title}`,
          requireInteraction: true, // Mantém a notificação visível até o usuário interagir
        }
        if (vibrate) notifOptions.vibrate = [300, 200, 300]
        await reg.showNotification(title, notifOptions)
        console.log('[alarm] Notificação enviada com sucesso')
        return
      }
    } catch (err) {
      console.error('[alarm] Erro ao enviar notificação:', err)
    }
  }

  // Fallback
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notifOpts: NotificationOptions = {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: `planner-${title}`,
      }
      if (vibrate) (notifOpts as any).vibrate = [300, 200, 300]
      new Notification(title, notifOpts)
    } catch (err) {
      console.error('[alarm] Erro no fallback:', err)
    }
  } else {
    console.warn(`[alarm] Sem permissão: ${Notification.permission}`)
  }
}

export function previewSound(type: AlarmType) {
  playDefaultBeep(type)
}

/** Teste de notificação completa */
export async function testNotification(type: AlarmType = 'task') {
  console.log('[alarm] Teste de notificação')

  const user = getCurrentUser()
  const uid = user?.id?.toString() ?? ''
  const settings = uid ? await db.settings.where('userId').equals(uid).first() : undefined

  const soundMap: Record<AlarmType, string | undefined> = {
    task: settings?.taskSound || settings?.notificationSound || '',
    event: settings?.eventSound || settings?.notificationSound || '',
    habit: settings?.habitSound || settings?.notificationSound || '',
  }
  const soundUrl = soundMap[type]
  const vibrate = settings?.notificationVibrate ?? true
  const pushEnabled =
    (settings?.notificationPush ?? false) &&
    'Notification' in window &&
    Notification.permission === 'granted'

  playSound(soundUrl ?? '', type)

  if (vibrate && navigator.vibrate) {
    navigator.vibrate([300, 200, 300, 200, 500])
  }

  if (pushEnabled) {
    await showNotification(
      `Teste — ${type === 'task' ? 'Tarefa' : type === 'event' ? 'Evento' : 'Hábito'}`,
      'Notificação de teste do Meu Planner',
      vibrate,
    )
  } else {
    console.warn('[alarm] Push não ativado')
  }

  return { pushEnabled, vibrate, hasSound: !!soundUrl }
}

export type SoundPreset = {
  id: string
  name: string
  description: string
  frequencies: [number, number]
}

export const SOUND_PRESETS: Record<AlarmType, SoundPreset[]> = {
  task: [
    { id: 'task-classic', name: 'Clássico', description: 'Doce e suave', frequencies: [523, 659] },
    { id: 'task-urgent', name: 'Urgente', description: 'Agudo e rápido', frequencies: [880, 1100] },
    { id: 'task-gentle', name: 'Suave', description: 'Calmo e relaxante', frequencies: [392, 494] },
    { id: 'task-digital', name: 'Digital', description: 'Estilo technological', frequencies: [660, 880] },
  ],
  event: [
    { id: 'event-classic', name: 'Clássico', description: 'Padrão de evento', frequencies: [440, 554] },
    { id: 'event-bright', name: 'Brilhante', description: 'Alegre e chamativo', frequencies: [659, 831] },
    { id: 'event-calm', name: 'Calmo', description: 'Notificação discreta', frequencies: [330, 415] },
    { id: 'event-alert', name: 'Alerta', description: 'Chama atenção', frequencies: [784, 988] },
  ],
  habit: [
    { id: 'habit-classic', name: 'Clássico', description: 'Padrão de hábito', frequencies: [587, 740] },
    { id: 'habit-energy', name: 'Energia', description: 'Motivador e forte', frequencies: [698, 880] },
    { id: 'habit-soft', name: 'Leve', description: 'Sutil e amigável', frequencies: [440, 554] },
    { id: 'habit-rhythm', name: 'Ritmo', description: 'Sequência rítmica', frequencies: [523, 698] },
  ],
}

export function playSoundPreset(presetId: string) {
  for (const type of Object.keys(SOUND_PRESETS) as AlarmType[]) {
    const preset = SOUND_PRESETS[type].find((p) => p.id === presetId)
    if (preset) {
      playFrequencies(preset.frequencies)
      return
    }
  }
}

function playFrequencies([freq1, freq2]: [number, number]) {
  try {
    const ctx = getAudioContext()

    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.frequency.value = freq1
    osc1.type = 'sine'
    gain1.gain.setValueAtTime(0.3, ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc1.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 0.3)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.frequency.value = freq2
    osc2.type = 'sine'
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.2)
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    osc2.start(ctx.currentTime + 0.2)
    osc2.stop(ctx.currentTime + 0.5)
  } catch {
    // AudioContext not available
  }
}

// ====== Web Push Subscription ======

const VAPID_PUBLIC_KEY = 'BMW8yoZw3zdnHpyaIF9MBpbOZZlhS2wySLhEuahJ_a69z05fwd1vRzcZzAzznV4bKCNUs2LVR3rygKt_Lvju2CM'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPush(): Promise<{ success: boolean; error?: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, error: 'Push não suportado neste navegador' }
  }

  try {
    const permission = await requestNotificationPermission()
    if (!permission) {
      return { success: false, error: 'Permissão de notificação negada' }
    }

    let reg = await navigator.serviceWorker.getRegistration()
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js')
    }

    let subscription = await reg.pushManager.getSubscription()

    if (subscription) {
      try {
        await subscription.unsubscribe()
        subscription = null
      } catch {
        subscription = null
      }
    }

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
    }

    const subJson = subscription.toJSON()
    const user = getCurrentUser()
    if (!user) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    const { getSheetsUrl } = await import('./sheets-sync')
    const url = getSheetsUrl()
    if (!url) {
      return { success: false, error: 'URL do banco não configurada' }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'subscribe',
        userId: user.id.toString(),
        subscription: {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        },
      }),
    })
    const data = await res.json()

    if (data.success) {
      console.log('[push] Inscrito com sucesso')
      return { success: true }
    } else {
      return { success: false, error: data.error || 'Erro ao salvar inscrição' }
    }
  } catch (err) {
    console.error('[push] Erro ao inscrever:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return { success: false, error: 'Service Worker não registrado' }

    const subscription = await reg.pushManager.getSubscription()
    if (!subscription) return { success: true }

    const endpoint = subscription.endpoint
    await subscription.unsubscribe()

    const user = getCurrentUser()
    if (user) {
      const { getSheetsUrl } = await import('./sheets-sync')
      const url = getSheetsUrl()
      if (url) {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'unsubscribe',
            userId: user.id.toString(),
            endpoint,
          }),
        })
      }
    }

    console.log('[push] Desinscrito com sucesso')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return false
    const subscription = await reg.pushManager.getSubscription()
    return !!subscription
  } catch {
    return false
  }
}
