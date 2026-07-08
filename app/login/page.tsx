import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { LogIn } from 'lucide-react'
import { Modal } from '@/components/ui/modal'

export default function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [loginField, setLoginField] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [versionModalOpen, setVersionModalOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!loginField.trim() || !password.trim()) {
      setError('Preencha todos os campos')
      return
    }
    const result = await login(loginField.trim(), password)
    if (result.success) {
      navigate('/')
    } else {
      setError(result.error || 'Erro ao entrar')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <LogIn className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Entrar</h1>
          <p className="text-sm text-muted-foreground">Acesse seus dados</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="Email ou nome de usuário"
            value={loginField}
            onChange={(e) => setLoginField(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Não tem conta?{' '}
          <Link to="/registro" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </p>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/esqueci-senha" className="font-medium text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </p>

        {/* Logo Itera */}
        <div className="flex justify-center pt-8">
          <button
            onClick={() => setVersionModalOpen(true)}
            className="opacity-30 transition-opacity hover:opacity-60 active:scale-95"
          >
            <img
              src="/icons/ITERA%20SEM%20FUNDO%20P_.png"
              alt="Itera"
              className="h-9 w-auto"
            />
          </button>
        </div>
      </div>

      {/* Modal de nota de versão */}
      <Modal open={versionModalOpen} onOpenChange={setVersionModalOpen} title="Nota de Versão">
        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground">Planner v0.1.0</p>
            <p className="mt-1">Desenvolvido por Itera</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="font-medium text-foreground">Novidades</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Planejamento diário com tarefas, eventos e hábitos</li>
              <li>Notas rápidas</li>
              <li>Sincronização com Google Sheets</li>
              <li>Suporte a modo offline</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground/70">
            © 2026 Itera — Todos os direitos reservados
          </p>
        </div>
      </Modal>
    </div>
  )
}
