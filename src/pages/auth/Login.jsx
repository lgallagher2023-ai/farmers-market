import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import Alert from '../../components/ui/Alert'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Fetch account type to redirect correctly
    const { data: userRow } = await supabase
      .from('users')
      .select('account_type')
      .eq('id', data.user.id)
      .single()

    const type = userRow?.account_type
    if (from) {
      navigate(from, { replace: true })
    } else if (type === 'vendor') {
      navigate('/vendor/dashboard', { replace: true })
    } else if (type === 'admin') {
      navigate('/admin', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🌿</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {error && <Alert type="error" className="mb-4">{error}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          New customer?{' '}
          <Link to="/signup" className="text-brand-600 font-medium hover:underline">
            Create account
          </Link>
        </p>
        <p className="text-center text-sm text-gray-500 mt-2">
          Selling at markets?{' '}
          <Link to="/vendor/signup" className="text-brand-600 font-medium hover:underline">
            Vendor sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
