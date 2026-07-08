import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FabProvider } from './hooks/use-fab'
import { ToastProvider, useToast } from './components/ui/toast'
import { AuthProvider, useAuth } from './hooks/use-auth'
import { AuthGuard } from './components/auth-guard'
import { AppShell } from './components/planner/app-shell'
import { isSheetsConfigured, importFromSheets } from './lib/sheets-sync'
import { db } from './lib/db'
import LoginPage from '../app/login/page'
import RegistroPage from '../app/registro/page'
import EsqueciSenhaPage from '../app/esqueci-senha/page'
import RedefinirSenhaPage from '../app/redefinir-senha/page'
import HomePage from '../app/page'
import TarefasPage from '../app/tarefas/page'
import CalendarioPage from '../app/calendario/page'
import HabitosPage from '../app/habitos/page'
import NotasPage from '../app/notas/page'
import AjustesPage from '../app/ajustes/page'

function AutoImportFromSheets() {
  const { user } = useAuth()

  useEffect(() => {
    if (!isSheetsConfigured() || !user) return
    const uid = user.id.toString()

    async function getLocalCounts() {
      const [tasks, events, habits, notes] = await Promise.all([
        db.tasks.where('userId').equals(uid).count(),
        db.events.where('userId').equals(uid).count(),
        db.habits.where('userId').equals(uid).count(),
        db.notes.where('userId').equals(uid).count(),
      ])
      return { tasks, events, habits, notes }
    }

    // Importação inicial silenciosa
    const timer = setTimeout(() => {
      importFromSheets().catch(() => {})
    }, 1000)

    // Sincronização em tempo real a cada 5 minutos (reduz conflito com edições locais)
    const pollInterval = setInterval(async () => {
      const before = await getLocalCounts()
      await importFromSheets().catch(() => {})
      const after = await getLocalCounts()

      // Só notifica se houve mudança real nos dados
      const changed =
        before.tasks !== after.tasks ||
        before.events !== after.events ||
        before.habits !== after.habits ||
        before.notes !== after.notes

      // Atualizações silenciosas — o Dexie liveQuery já refaz a UI automaticamente
      if (changed) {
        console.log('[sync] Dados atualizados do banco de dados')
      }
    }, 5 * 60_000)

    return () => {
      clearTimeout(timer)
      clearInterval(pollInterval)
    }
  }, [user])

  return null
}

function SwUpdatePrompt() {
  const { toast } = useToast()

  useEffect(() => {
    const handler = (e: Event) => {
      const { registration } = (e as CustomEvent).detail
      toast('info', 'Nova versão disponível. Atualizando...')
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
      // Reload once the new SW takes over
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!reloaded) {
          reloaded = true
          window.location.reload()
        }
      })
    }
    window.addEventListener('sw-update', handler)
    return () => window.removeEventListener('sw-update', handler)
  }, [toast])

  return null
}

function ProtectedApp() {
  return (
    <AppShell>
      <AutoImportFromSheets />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tarefas" element={<TarefasPage />} />
        <Route path="/calendario" element={<CalendarioPage />} />
        <Route path="/habitos" element={<HabitosPage />} />
        <Route path="/notas" element={<NotasPage />} />
        <Route path="/ajustes" element={<AjustesPage />} />
      </Routes>
    </AppShell>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <FabProvider>
      <ToastProvider>
        <SwUpdatePrompt />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegistroPage />} />
          <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
          <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
          <Route path="*" element={
            <AuthGuard>
              <ProtectedApp />
            </AuthGuard>
          } />
        </Routes>
      </ToastProvider>
      </FabProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
