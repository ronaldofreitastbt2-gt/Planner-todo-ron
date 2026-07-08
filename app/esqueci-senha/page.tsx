import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useToast } from '@/components/ui/toast'
import { getSheetsUrl } from '@/lib/sheets-sync'
import { Mail, ArrowLeft } from 'lucide-react'

export default function EsqueciSenhaPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    try {
      const url = getSheetsUrl()
      if (!url) {
        toast('error', 'Banco de dados não configurado')
        return
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'forgotPassword', email: email.trim() }),
      })
      const json = await res.json()

      if (json.success) {
        setSent(true)
      } else {
        toast('error', json.error || 'Erro ao enviar código')
      }
    } catch {
      toast('error', 'Erro na conexão com o servidor')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Código enviado!</h1>
          <p className="text-sm text-muted-foreground">
            Verifique seu email <strong>{email}</strong> e copie o código de 6 dígitos.
          </p>
          <button
            onClick={() => navigate('/redefinir-senha', { state: { email } })}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98]"
          >
            Inserir código
          </button>
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

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Esqueci minha senha</h1>
          <p className="text-sm text-muted-foreground">
            Informe seu email para receber um código de redefinição
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar código'}
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
