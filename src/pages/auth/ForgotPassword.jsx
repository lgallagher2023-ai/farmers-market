import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import Alert from '../../components/ui/Alert'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setLoading(true)

    const redirectTo =
      (import.meta.env.VITE_APP_URL ?? window.location.origin) + '/reset-password'

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🌿</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Reset your password</h1>
          <p className="mt-1 text-sm text-gray-500">
            {sent ? 'Check your inbox' : "We'll send you a link to reset it"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {sent ? (
            <div className="text-center py-2">
              <p className="text-4xl mb-4">📬</p>
              <p className="text-sm text-gray-700 font-medium mb-1">Email sent to {email}</p>
              <p className="text-sm text-gray-500 mb-6">
                Click the link in the email to set a new password. It may take a minute to arrive.
              </p>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => { setSent(false); setEmail('') }}
              >
                Send again
              </Button>
            </div>
          ) : (
            <>
              {error && <Alert type="error" className="mb-4">{error}</Alert>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
                <Button type="submit" loading={loading} className="w-full" size="lg">
                  Send reset link
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-brand-600 font-medium hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
