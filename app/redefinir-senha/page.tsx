import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useToast } from '@/components/ui/toast'
import { getSheetsUrl } from '@/lib/sheets-sync'
import { Lock, ArrowLeft, CheckCircle } from 'lucide-react'

export default function RedefinirSenhaPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as any)?.email || ''

  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !password.trim() || !confirmPassword.trim()) return

    if (password !== confirmPassword) {
      toast('error', 'As senhas não coincidem')
      return
    }
    if (password.length < 4) {
      toast('error', 'A senha deve ter pelo menos 4 caracteres')
      return
    }

    setLoading(true)
    try {
      const url = getSheetsUrl()
      if (!url) {
        toast('error', 'Banco de dados não configurado')
        return
      }

      const encoder = new TextEncoder()
      const data = encoder.encode(password)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'resetPassword',
          email,
          code: code.trim(),
          newPassword: passwordHash,
        }),
      })
      const json = await res.json()

      if (json.success) {
        setDone(true)
      } else {
        toast('error', json.error || 'Código inválido')
      }
    } catch {
      toast('error', 'Erro na conexão com o servidor')
    } finally {
      setLoading(false)
    }
  }

  if (!email) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <p className="text-sm text-muted-foreground">
            Acesso inválido. Solicite um novo código de redefinição.
          </p>
          <Link
            to="/esqueci-senha"
            className="w-full inline-block rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            Solicitar código
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Senha redefinida!</h1>
          <p className="text-sm text-muted-foreground">
            Sua senha foi alterada com sucesso.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98]"
          >
            Entrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground">
            Insira o código de 6 dígitos enviado para <strong>{email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Código de 6 dígitos"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoFocus
            maxLength={6}
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-center text-lg tracking-widest outline-none focus:ring-2 focus:ring-ring"
          />

          <input
            type="password"
            placeholder="Nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <button
            type="submit"
            disabled={loading || !code || !password || !confirmPassword}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Redefinindo...' : 'Redefinir senha'}
          </button>
        </form>

        <Link
          to="/login"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar ao login
        </Link>
      </div>
    </div>
  )
}
