import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import Alert from '../../components/ui/Alert'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)

  useEffect(() => {
    // detectSessionInUrl:true in supabase.js automatically processes the recovery
    // token from the URL hash. We listen for the PASSWORD_RECOVERY event to know
    // when the session is established and the form is safe to submit.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryReady(true)
      }
    })

    // Also check if there's already a session (in case the event fired before mount)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setRecoveryReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  function validate() {
    const e = {}
    if (form.password.length < 8) e.password = 'At least 8 characters'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setServerError('')
    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password: form.password })

    if (error) {
      setServerError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    // Sign out the recovery session then send the user to login
    setTimeout(async () => {
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    }, 2500)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🌿</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Set a new password</h1>
          <p className="mt-1 text-sm text-gray-500">Choose something strong</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {success ? (
            <div className="text-center py-2">
              <p className="text-4xl mb-4">✅</p>
              <p className="text-sm font-medium text-gray-900 mb-1">Password updated!</p>
              <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              {serverError && <Alert type="error" className="mb-4">{serverError}</Alert>}
              {!recoveryReady && (
                <Alert type="info" className="mb-4">
                  Verifying your reset link…
                </Alert>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="New password"
                  type="password"
                  value={form.password}
                  onChange={e => {
                    setForm(f => ({ ...f, password: e.target.value }))
                    setErrors(ev => ({ ...ev, password: '' }))
                  }}
                  error={errors.password}
                  placeholder="At least 8 characters"
                  required
                  autoComplete="new-password"
                  autoFocus
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  value={form.confirm}
                  onChange={e => {
                    setForm(f => ({ ...f, confirm: e.target.value }))
                    setErrors(ev => ({ ...ev, confirm: '' }))
                  }}
                  error={errors.confirm}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                <Button
                  type="submit"
                  loading={loading}
                  disabled={!recoveryReady}
                  className="w-full"
                  size="lg"
                >
                  Update password
                </Button>
              </form>
            </>
          )}
        </div>

        {!success && (
          <p className="text-center text-sm text-gray-500 mt-6">
            <Link to="/login" className="text-brand-600 font-medium hover:underline">
              ← Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
