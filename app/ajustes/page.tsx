import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInstallPrompt } from '@/hooks/use-install-prompt'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Moon,
  Sun,
  Palette,
  Image,
  Bell,
  Database,
  ChevronDown,
  Download,
  Upload,
  Trash2,
  Monitor,
  Vibrate,
  Clock,
  Cloud,
  RefreshCw,
  CheckCircle2,
  Link2,
  LogOut,
  Smartphone,
  CheckSquare,
  Calendar,
  Flame,
} from 'lucide-react'
import { PageHeader } from '@/components/planner/page-header'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { db, type AppSettings } from '@/lib/db'
import { useAuth } from '@/hooks/use-auth'
import { DEFAULT_SETTINGS, SVG_PRESETS } from '@/lib/settings-defaults'
import { useToast } from '@/components/ui/toast'
import { SoundPickerModal } from '@/components/ui/sound-picker-modal'
import { requestNotificationPermission, SOUND_PRESETS, playSoundPreset, testNotification, subscribeToPush, unsubscribeFromPush } from '@/lib/alarm-manager'
import {
  getSheetsUrl,
  setSheetsUrl,
  isSheetsConfigured,
  testSheetsConnection,
  fullSyncToSheets,
  importFromSheets,
  syncSettings,
} from '@/lib/sheets-sync'

const THEMES = [
  { id: '', label: 'Padrão', color: '#10b981' },
  { id: 'blue', label: 'Azul', color: '#3b82f6' },
  { id: 'purple', label: 'Roxo', color: '#8b5cf6' },
  { id: 'pink', label: 'Rosa', color: '#ec4899' },
  { id: 'orange', label: 'Laranja', color: '#f59e0b' },
  { id: 'mono', label: 'Mono', color: '#374151' },
]

const BG_COLORS = [
  { label: 'Nenhum', value: '' },
  { label: 'Suave', value: '#f0fdf4' },
  { label: 'Azul', value: '#eff6ff' },
  { label: 'Rosa', value: '#fdf2f8' },
  { label: 'Laranja', value: '#fff7ed' },
  { label: 'Escuro', value: '#1a1a2e' },
]

const BG_TYPES = [
  { value: 'color', label: 'Cor sólida' },
  { value: 'svg', label: 'Animação SVG' },
  { value: 'image', label: 'Imagem' },
  { value: 'gif', label: 'GIF animado' },
] as const

type Section = 'aparencia' | 'fundo' | 'notificacoes' | 'dados' | 'instalar' | 'nuvem'

export default function AjustesPage() {
  const { toast } = useToast()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const uid = user?.id?.toString() ?? ''
  const settings = useLiveQuery(() => uid ? db.settings.where('userId').equals(uid).first() : undefined, [uid])
  const [expanded, setExpanded] = useState<Section | null>(null)

  const [dark, setDark] = useState(false)
  const [theme, setTheme] = useState('')
  const [bgType, setBgType] = useState<AppSettings['bgType']>('color')
  const [bgColor, setBgColor] = useState('')
  const [bgSvgPreset, setBgSvgPreset] = useState('')
  const [bgImageDataUrl, setBgImageDataUrl] = useState('')
  const [bgOverlayOpacity, setBgOverlayOpacity] = useState(0)
  const [bgOverlayBlur, setBgOverlayBlur] = useState(0)
  const [notificationSound, setNotificationSound] = useState('')
  const [taskSound, setTaskSound] = useState('')
  const [eventSound, setEventSound] = useState('')
  const [habitSound, setHabitSound] = useState('')
  const [notificationVibrate, setNotificationVibrate] = useState(true)
  const [notificationPush, setNotificationPush] = useState(false)
  const [alarmMinutesBefore, setAlarmMinutesBefore] = useState(5)
  const [sheetsUrl, setSheetsUrlState] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [soundPickerType, setSoundPickerType] = useState<'task' | 'event' | 'habit' | null>(null)
  const { canInstall, isInstalled, install } = useInstallPrompt()

  // Load from DB on mount
  useEffect(() => {
    setSheetsUrlState(getSheetsUrl())
    // Verificar estado real da permissão do browser
    const hasPermission = 'Notification' in window && Notification.permission === 'granted'
    if (hasPermission) setNotificationPush(true)

    if (settings) {
      setDark(settings.dark)
      setTheme(settings.theme)
      setBgType(settings.bgType)
      setBgColor(settings.bgColor)
      setBgSvgPreset(settings.bgSvgPreset)
      setBgImageDataUrl(settings.bgImageDataUrl)
      setBgOverlayOpacity(settings.bgOverlayOpacity)
      setBgOverlayBlur(settings.bgOverlayBlur)
      setNotificationSound(settings.notificationSound)
      setTaskSound(settings.taskSound ?? '')
      setEventSound(settings.eventSound ?? '')
      setHabitSound(settings.habitSound ?? '')
      setNotificationVibrate(settings.notificationVibrate)
      setNotificationPush(settings.notificationPush ?? false)
      setAlarmMinutesBefore(settings.alarmMinutesBefore)
    } else {
      // First access: init from defaults + current DOM state
      const isDark = document.documentElement.classList.contains('dark')
      const currentTheme = document.documentElement.getAttribute('data-theme') ?? ''
      setDark(isDark)
      setTheme(currentTheme)
    }
  }, [settings])

  // Sync dark to DOM immediately
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // Sync theme to DOM immediately
  useEffect(() => {
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme)
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [theme])

  async function persist(patch: Partial<AppSettings>) {
    if (!uid) return
    const existing = await db.settings.where('userId').equals(uid).first()
    let merged: AppSettings
    if (existing) {
      await db.settings.update(existing.id!, patch)
      merged = { ...existing, ...patch }
    } else {
      merged = { id: 1, ...DEFAULT_SETTINGS, ...patch, userId: uid } as AppSettings
      await db.settings.add(merged)
    }
    await syncSettings(merged)
  }

  function toggleDark() {
    const next = !dark
    setDark(next)
    persist({ dark: next })
  }

  function selectTheme(id: string) {
    setTheme(id)
    persist({ theme: id })
  }

  function handleBgType(t: AppSettings['bgType']) {
    setBgType(t)
    persist({ bgType: t })
  }

  function handleBgColor(c: string) {
    setBgColor(c)
    persist({ bgColor: c, bgType: c ? 'color' : bgType })
  }

  function handleSvgPreset(p: string) {
    setBgSvgPreset(p)
    persist({ bgSvgPreset: p, bgType: 'svg' })
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type.includes('gif')) {
      const reader = new FileReader()
      reader.onload = () => {
        const url = reader.result as string
        setBgImageDataUrl(url)
        persist({ bgImageDataUrl: url, bgType: 'gif' })
      }
      reader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxW = 400
        const maxH = 300
        let w = img.width
        let h = img.height

        if (w > maxW) { h = h * maxW / w; w = maxW }
        if (h > maxH) { w = w * maxH / h; h = maxH }

        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)

        let compressed = canvas.toDataURL('image/jpeg', 0.4)
        let tries = 0
        while (compressed.length > 30000 && tries < 5) {
          tries++
          const q = Math.max(0.05, 0.4 - tries * 0.07)
          const scale = Math.max(0.3, 1 - tries * 0.15)
          canvas.width = Math.round(w * scale)
          canvas.height = Math.round(h * scale)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          compressed = canvas.toDataURL('image/jpeg', q)
        }

        setBgImageDataUrl(compressed)
        persist({ bgImageDataUrl: compressed, bgType: 'image' })
        toast('success', `Imagem salva (${Math.round(compressed.length / 1024)}KB, ${compressed.length} chars)`)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  function handleOverlayOpacity(v: number) {
    setBgOverlayOpacity(v)
    persist({ bgOverlayOpacity: v })
  }

  function handleOverlayBlur(v: number) {
    setBgOverlayBlur(v)
    persist({ bgOverlayBlur: v })
  }

  function handleSoundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      setNotificationSound(url)
      persist({ notificationSound: url })
      toast('success', 'Som de notificação salvo')
    }
    reader.readAsDataURL(file)
  }

  function handleVibrate(v: boolean) {
    setNotificationVibrate(v)
    persist({ notificationVibrate: v })
  }

  async function handlePushToggle() {
    if (!notificationPush) {
      // Ativar push
      toast('info', 'Configurando notificações...')
      const result = await subscribeToPush()
      if (result.success) {
        setNotificationPush(true)
        persist({ notificationPush: true })
        toast('success', 'Notificações push ativadas! Você receberá alertas mesmo com o app fechado.')
      } else {
        toast('error', result.error || 'Erro ao ativar push')
      }
    } else {
      // Desativar push
      await unsubscribeFromPush()
      setNotificationPush(false)
      persist({ notificationPush: false })
      toast('info', 'Notificações push desativadas')
    }
  }

  function handleTypeSound(type: 'taskSound' | 'eventSound' | 'habitSound', value: string) {
    if (type === 'taskSound') setTaskSound(value)
    else if (type === 'eventSound') setEventSound(value)
    else setHabitSound(value)
    persist({ [type]: value })
  }

  function handleTypeSoundUpload(type: 'taskSound' | 'eventSound' | 'habitSound', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      handleTypeSound(type, url)
      toast('success', 'Som salvo')
    }
    reader.readAsDataURL(file)
  }

  function handleAlarmMinutes(v: number) {
    setAlarmMinutesBefore(v)
    persist({ alarmMinutesBefore: v })
  }

  async function handleExport() {
    const data = {
      tasks: await db.tasks.toArray(),
      events: await db.events.toArray(),
      habits: await db.habits.toArray(),
      habitLogs: await db.habitLogs.toArray(),
      notes: await db.notes.toArray(),
      settings: await db.settings.get(1),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('success', 'Backup exportado')
  }

  async function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text)
        if (data.tasks) await db.tasks.bulkPut(data.tasks)
        if (data.events) await db.events.bulkPut(data.events)
        if (data.habits) await db.habits.bulkPut(data.habits)
        if (data.habitLogs) await db.habitLogs.bulkPut(data.habitLogs)
        if (data.notes) await db.notes.bulkPut(data.notes)
        if (data.settings) await db.settings.put(data.settings)
        toast('success', 'Backup restaurado. Recarregue a página.')
      } catch {
        toast('error', 'Arquivo inválido')
      }
    }
    input.click()
  }

  async function handleClear() {
    await db.tasks.clear()
    await db.events.clear()
    await db.habits.clear()
    await db.habitLogs.clear()
    await db.notes.clear()
    await db.settings.clear()
    toast('warning', 'Dados apagados. Recarregue a página.')
  }

  function toggleSection(s: Section) {
    setExpanded((prev) => (prev === s ? null : s))
  }

  return (
    <>
      <PageHeader title="Ajustes" />

      <div className="space-y-3 px-5 pb-8">
        {/* ====== Aparência ====== */}
        <SectionCard
          icon={<Palette className="size-5 text-primary" />}
          title="Aparência"
          expanded={expanded === 'aparencia'}
          onToggle={() => toggleSection('aparencia')}
        >
          {/* Dark mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {dark ? <Moon className="size-4 text-primary" /> : <Sun className="size-4 text-primary" />}
              <div>
                <p className="text-sm font-medium">Modo escuro</p>
                <p className="text-xs text-muted-foreground">{dark ? 'Ativado' : 'Desativado'}</p>
              </div>
            </div>
            <button
              onClick={toggleDark}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                dark ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute left-0.5 size-6 rounded-full bg-white shadow transition-transform ${
                  dark ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <hr className="border-border" />

          {/* Color palette */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Paleta de cores</p>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTheme(t.id)}
                  className={`flex items-center gap-2 rounded-xl p-3 text-sm font-medium transition-all ${
                    theme === t.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  <span className="size-3 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* ====== Plano de Fundo ====== */}
        <SectionCard
          icon={<Image className="size-5 text-primary" />}
          title="Plano de Fundo"
          expanded={expanded === 'fundo'}
          onToggle={() => toggleSection('fundo')}
        >
          {/* Type selector */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Tipo</p>
            <div className="grid grid-cols-4 gap-2">
              {BG_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleBgType(t.value)}
                  className={`rounded-xl py-2.5 text-xs font-medium transition-all ${
                    bgType === t.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          {bgType === 'color' && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Cor de fundo</p>
              <div className="flex flex-wrap gap-2">
                {BG_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => handleBgColor(c.value)}
                    className={`relative size-10 rounded-xl border-2 transition-all ${
                      bgColor === c.value ? 'border-primary' : 'border-border'
                    }`}
                    style={{
                      backgroundColor: c.value || '#f0f0f0',
                    }}
                  >
                    {!c.value && (
                      <span className="absolute inset-0 flex items-center justify-center text-lg">🚫</span>
                    )}
                  </button>
                ))}
              </div>
              <input
                type="color"
                value={bgColor || '#ffffff'}
                onChange={(e) => handleBgColor(e.target.value)}
                className="mt-2 h-10 w-full cursor-pointer rounded-xl border border-border"
              />
            </div>
          )}

          {/* SVG presets */}
          {bgType === 'svg' && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Animação SVG</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(SVG_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => handleSvgPreset(key)}
                    className={`rounded-xl p-3 text-sm font-medium transition-all ${
                      bgSvgPreset === key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Image/GIF upload */}
          {(bgType === 'image' || bgType === 'gif') && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {bgType === 'gif' ? 'GIF animado' : 'Imagem'}
              </p>
              <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border p-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                <Upload className="size-5 mr-2" />
                Selecionar arquivo
                <input
                  type="file"
                  accept={bgType === 'gif' ? 'image/gif' : 'image/*'}
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              {bgImageDataUrl && (
                <img
                  src={bgImageDataUrl}
                  alt="Preview"
                  className="mt-2 h-20 w-full rounded-xl object-cover"
                />
              )}
            </div>
          )}

          {/* Overlay controls */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Overlay</p>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">
                  {bgOverlayOpacity < 0 ? 'Clarear' : bgOverlayOpacity > 0 ? 'Escurecer' : 'Neutro'}
                </span>
                <span className="text-xs font-medium">{bgOverlayOpacity > 0 ? '+' : ''}{bgOverlayOpacity}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Monitor className="size-4 text-muted-foreground shrink-0" />
                <div className="relative flex-1">
                  <div className="absolute inset-y-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
                  <div
                    className="absolute inset-y-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary/50"
                    style={{
                      left: bgOverlayOpacity < 0 ? `${50 + bgOverlayOpacity / 1.6}%` : '50%',
                      right: bgOverlayOpacity > 0 ? `${50 - bgOverlayOpacity / 1.6}%` : '50%',
                    }}
                  />
                  <input
                    type="range"
                    min={-80}
                    max={80}
                    value={bgOverlayOpacity}
                    onChange={(e) => handleOverlayOpacity(Number(e.target.value))}
                    className="relative w-full h-6 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
                  />
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Blur</span>
                <span className="text-xs font-medium">{bgOverlayBlur}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={bgOverlayBlur}
                onChange={(e) => handleOverlayBlur(Number(e.target.value))}
                className="w-full h-6 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
              />
            </div>
          </div>
        </SectionCard>

        {/* ====== Notificações ====== */}
        <SectionCard
          icon={<Bell className="size-5 text-primary" />}
          title="Notificações"
          expanded={expanded === 'notificacoes'}
          onToggle={() => toggleSection('notificacoes')}
        >
          {/* Push notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="size-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Notificações push</p>
                <p className="text-xs text-muted-foreground">
                  {notificationPush ? 'Ativadas' : 'Desativadas'}
                </p>
              </div>
            </div>
            <button
              onClick={handlePushToggle}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                notificationPush ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute left-0.5 size-6 rounded-full bg-white shadow transition-transform ${
                  notificationPush ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Test notification button */}
          <button
            onClick={async () => {
              const result = await testNotification('task')
              if (!result.pushEnabled) {
                toast('warning', 'Push desativado. Ative o toggle acima e permita no navegador.')
              } else {
                toast('success', 'Notificação de teste enviada')
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-xs font-medium transition-all active:scale-[0.98]"
          >
            <Bell className="size-3.5" />
            Testar notificação (som + vibração + push)
          </button>

          <hr className="border-border" />

          {/* Vibrate */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Vibrate className="size-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Vibração</p>
                <p className="text-xs text-muted-foreground">
                  {notificationVibrate ? 'Ativada' : 'Desativada'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleVibrate(!notificationVibrate)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                notificationVibrate ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute left-0.5 size-6 rounded-full bg-white shadow transition-transform ${
                  notificationVibrate ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <hr className="border-border" />

          {/* Sound */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Som padrão de notificação
            </p>
            <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
              <Upload className="size-4 mr-2" />
              Selecionar áudio (.mp3, .wav, .ogg)
              <input
                type="file"
                accept="audio/*"
                onChange={handleSoundUpload}
                className="hidden"
              />
            </label>
            {notificationSound && (
              <audio controls className="mt-2 w-full h-8">
                <source src={notificationSound} />
              </audio>
            )}
          </div>

          <hr className="border-border" />

          {/* Per-type sounds */}
          <div>
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              Sons por tipo de alerta
            </p>

            {/* Tasks */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <CheckSquare className="size-3.5 text-primary" />
                  <span className="text-xs font-medium">Tarefas</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSoundPickerType('task')}
                  className={`flex-1 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                    !taskSound
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {taskSound ? 'Som padrão' : 'Selecionar som'}
                </button>
                <label className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border p-2.5 text-xs transition-all ${
                  taskSound
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}>
                  <Upload className="size-3.5 mr-1.5" />
                  {taskSound ? 'Trocar' : 'Áudio custom'}
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleTypeSoundUpload('taskSound', e)}
                    className="hidden"
                  />
                </label>
              </div>
              {taskSound && (
                <div className="mt-1 flex items-center gap-2">
                  <audio controls className="w-full h-6">
                    <source src={taskSound} />
                  </audio>
                  <button
                    onClick={() => handleTypeSound('taskSound', '')}
                    className="text-xs text-destructive shrink-0"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>

            {/* Events */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-blue-500" />
                  <span className="text-xs font-medium">Eventos</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSoundPickerType('event')}
                  className={`flex-1 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                    !eventSound
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {eventSound ? 'Som padrão' : 'Selecionar som'}
                </button>
                <label className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border p-2.5 text-xs transition-all ${
                  eventSound
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}>
                  <Upload className="size-3.5 mr-1.5" />
                  {eventSound ? 'Trocar' : 'Áudio custom'}
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleTypeSoundUpload('eventSound', e)}
                    className="hidden"
                  />
                </label>
              </div>
              {eventSound && (
                <div className="mt-1 flex items-center gap-2">
                  <audio controls className="w-full h-6">
                    <source src={eventSound} />
                  </audio>
                  <button
                    onClick={() => handleTypeSound('eventSound', '')}
                    className="text-xs text-destructive shrink-0"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>

            {/* Habits */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Flame className="size-3.5 text-orange-500" />
                  <span className="text-xs font-medium">Hábitos</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSoundPickerType('habit')}
                  className={`flex-1 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                    !habitSound
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {habitSound ? 'Som padrão' : 'Selecionar som'}
                </button>
                <label className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border p-2.5 text-xs transition-all ${
                  habitSound
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}>
                  <Upload className="size-3.5 mr-1.5" />
                  {habitSound ? 'Trocar' : 'Áudio custom'}
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleTypeSoundUpload('habitSound', e)}
                    className="hidden"
                  />
                </label>
              </div>
              {habitSound && (
                <div className="mt-1 flex items-center gap-2">
                  <audio controls className="w-full h-6">
                    <source src={habitSound} />
                  </audio>
                  <button
                    onClick={() => handleTypeSound('habitSound', '')}
                    className="text-xs text-destructive shrink-0"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>
          </div>

          <hr className="border-border" />

          {/* Alarm time */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Clock className="size-4 text-primary" />
              <p className="text-sm font-medium">Antecedência do alarme</p>
            </div>
            <select
              value={alarmMinutesBefore}
              onChange={(e) => handleAlarmMinutes(Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={0}>Na hora exata</option>
              <option value={5}>5 minutos antes</option>
              <option value={10}>10 minutos antes</option>
              <option value={15}>15 minutos antes</option>
              <option value={30}>30 minutos antes</option>
              <option value={60}>1 hora antes</option>
              <option value={120}>2 horas antes</option>
              <option value={1440}>1 dia antes</option>
            </select>
          </div>
        </SectionCard>

        {/* ====== Dados ====== */}
        <SectionCard
          icon={<Database className="size-5 text-primary" />}
          title="Dados"
          expanded={expanded === 'dados'}
          onToggle={() => toggleSection('dados')}
        >
          <div className="space-y-2">
            <button
              onClick={handleExport}
              className="flex w-full items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-sm font-medium transition-all active:scale-[0.98]"
            >
              <Download className="size-4 text-primary" />
              Exportar backup (JSON)
            </button>
            <button
              onClick={handleImport}
              className="flex w-full items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-sm font-medium transition-all active:scale-[0.98]"
            >
              <Upload className="size-4 text-primary" />
              Importar backup
            </button>
            <button
              onClick={() => setConfirmClear(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-destructive/30 px-4 py-3 text-sm font-medium text-destructive transition-all active:scale-[0.98]"
            >
              <Trash2 className="size-4" />
              Limpar todos os dados
            </button>
          </div>
        </SectionCard>

        {/* ====== Instalar app ====== */}
        {!isInstalled && (
          <SectionCard
            icon={<Smartphone className="size-5 text-primary" />}
            title="Instalar app"
            expanded={expanded === 'instalar'}
            onToggle={() => toggleSection('instalar')}
          >
            {canInstall ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Instale o Planner no seu dispositivo para acesso rápido e uso offline.
                </p>
                <button
                  onClick={install}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98]"
                >
                  <Smartphone className="size-4" />
                  Instalar agora
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Abra este site no navegador do seu celular (Chrome, Safari ou Edge) e use o botão "Compartilhar" &gt; "Adicionar à tela inicial".
                </p>
                <div className="rounded-xl bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>iOS (Safari):</strong> Toque em <span className="font-mono">Compartilhar</span> &gt; <span className="font-mono">Adicionar à Tela de Início</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <strong>Android (Chrome):</strong> Toque em <span className="font-mono">⋮</span> &gt; <span className="font-mono">Instalar app</span>
                  </p>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* ====== Nuvem (banco de dados) ====== */}
        <SectionCard
          icon={<Cloud className="size-5 text-primary" />}
          title="Nuvem (banco de dados)"
          expanded={expanded === 'nuvem'}
          onToggle={() => toggleSection('nuvem')}
        >
          {/* URL input */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              URL do Apps Script (Web App)
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/..."
                value={sheetsUrl}
                onChange={(e) => setSheetsUrlState(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-secondary px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() => {
                  setSheetsUrl(sheetsUrl)
                  toast('success', 'URL salva')
                }}
                className="shrink-0 rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground transition-all active:scale-[0.98]"
              >
                Salvar
              </button>
            </div>
          </div>

          {/* Connection status + test */}
          <div className="flex items-center gap-3 rounded-xl bg-secondary/50 px-4 py-3">
            {isSheetsConfigured() ? (
              <>
                <CheckCircle2 className="size-4 text-primary" />
                <span className="text-xs font-medium">Configurado</span>
              </>
            ) : (
              <>
                <Link2 className="size-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Não configurado</span>
              </>
            )}
            <button
              onClick={async () => {
                if (!sheetsUrl) {
                  toast('warning', 'Informe a URL primeiro')
                  return
                }
                setTesting(true)
                const result = await testSheetsConnection()
                toast(result.success ? 'success' : 'error', result.success ? 'Conexão OK' : 'Falha na conexão')
                setTesting(false)
              }}
              disabled={testing || !sheetsUrl}
              className="ml-auto rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {testing ? 'Testando…' : 'Testar'}
            </button>
          </div>

          {/* Sync actions */}
          <div className="space-y-2">
            <button
              onClick={async () => {
                setSyncing(true)
                toast('info', 'Sincronizando…')
                const result = await fullSyncToSheets()
                toast(result.success ? 'success' : 'error', result.success ? 'Sincronização concluída' : 'Falha na sincronização')
                setSyncing(false)
              }}
              disabled={syncing || !isSheetsConfigured()}
              className="flex w-full items-center gap-3 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando…' : 'Enviar tudo para a nuvem'}
            </button>
            <button
              onClick={async () => {
                setSyncing(true)
                toast('info', 'Importando…')
                const result = await importFromSheets()
                toast(result.success ? 'success' : 'error', result.success ? 'Importação concluída' : 'Falha na importação')
                setSyncing(false)
              }}
              disabled={syncing || !isSheetsConfigured()}
              className="flex w-full items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Download className="size-4 text-primary" />
              Importar da nuvem
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Os dados são salvos automaticamente na nuvem quando conectado. Use "Enviar tudo" para forçar uma sincronização completa, ou "Importar" para baixar os dados do banco de dados.
          </p>
        </SectionCard>

        {/* Sobre */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Meu Planner</p>
          <p className="text-xs text-muted-foreground">Versão 0.2.0</p>
          {user && (
            <p className="mt-1 text-xs text-muted-foreground">
              Conectado como: {user.name}
            </p>
          )}
        </div>

        {/* Sair da conta */}
        <button
          onClick={() => {
            logout()
            navigate('/login')
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-card p-4 text-sm font-medium text-destructive transition-all active:scale-[0.98] hover:bg-destructive/5"
        >
          <LogOut className="size-4" />
          Sair da conta
        </button>

        {/* Excluir conta */}
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive bg-destructive/10 p-4 text-sm font-medium text-destructive transition-all active:scale-[0.98] hover:bg-destructive/10"
        >
          <Trash2 className="size-4" />
          Excluir minha conta e todos os dados
        </button>

        {/* Modal: Limpar dados */}
        <ConfirmModal
          open={confirmClear}
          onOpenChange={setConfirmClear}
          title="Limpar dados"
          message="Tem certeza? Todos os dados locais serão apagados permanentemente."
          confirmLabel="Limpar"
          danger
          onConfirm={handleClear}
        />

        {/* Modal: Excluir conta */}
        <ConfirmModal
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Excluir minha conta"
          message="Sua conta e TODOS os seus dados serão excluídos permanentemente do banco de dados. Esta ação não pode ser desfeita."
          confirmLabel="Excluir tudo"
          danger
          onConfirm={async () => {
            const { deleteAccount } = await import('@/lib/sheets-sync')
            const result = await deleteAccount()
            if (result.success) {
              toast('success', 'Conta excluída')
              await db.tasks.clear()
              await db.events.clear()
              await db.habits.clear()
              await db.habitLogs.clear()
              await db.notes.clear()
              await db.settings.clear()
              logout()
              navigate('/registro')
            } else {
              toast('error', `Falha ao excluir: ${result.error}`)
            }
          }}
        />

        {/* Modal: Selecionar som padrão */}
        {soundPickerType && (
          <SoundPickerModal
            open={!!soundPickerType}
            onOpenChange={() => setSoundPickerType(null)}
            title={`Som para ${soundPickerType === 'task' ? 'Tarefas' : soundPickerType === 'event' ? 'Eventos' : 'Hábitos'}`}
            presets={SOUND_PRESETS[soundPickerType].map((p) => ({
              ...p,
              play: () => playSoundPreset(p.id),
            }))}
            selected={soundPickerType === 'task' ? taskSound : soundPickerType === 'event' ? eventSound : habitSound}
            onSelect={(id) => {
              const field = soundPickerType === 'task' ? 'taskSound' : soundPickerType === 'event' ? 'eventSound' : 'habitSound'
              handleTypeSound(field, id)
            }}
          />
        )}
      </div>
    </>
  )
}

/* ====== Section Card ====== */

function SectionCard({
  icon,
  title,
  expanded,
  onToggle,
  children,
}: {
  icon: React.ReactNode
  title: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <ChevronDown
          className={`size-5 text-muted-foreground transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-4">{children}</div>
      )}
    </div>
  )
}
