import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { UserPlus } from 'lucide-react'

export default function RegistroPage() {
  const { register, loading } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('Preencha todos os campos')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }
    if (password.length < 4) {
      setError('A senha deve ter pelo menos 4 caracteres')
      return
    }

    const result = await register(name.trim(), email.trim(), password)
    if (result.success) {
      navigate('/')
    } else {
      setError(result.error || 'Erro ao criar conta')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <UserPlus className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Criar conta</h1>
          <p className="text-sm text-muted-foreground">Comece a organizar suas tarefas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <input
            type="password"
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
