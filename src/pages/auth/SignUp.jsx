import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import Alert from '../../components/ui/Alert'

export default function SignUp() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field) {
    return (e) => {
      setForm(f => ({ ...f, [field]: e.target.value }))
      setErrors(e => ({ ...e, [field]: '' }))
    }
  }

  function validate() {
    const e = {}
    if (!form.firstName.trim()) e.firstName = 'Required'
    if (!form.lastName.trim()) e.lastName = 'Required'
    if (!form.email.trim()) e.email = 'Required'
    if (form.password.length < 8) e.password = 'At least 8 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setServerError('')
    setLoading(true)

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
    })

    if (authError) {
      setServerError(authError.message)
      setLoading(false)
      return
    }

    const userId = authData.user.id

    // 2. Insert into users table
    const { error: profileError } = await supabase.from('users').insert({
      id: userId,
      email: form.email.trim(),
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      account_type: 'customer',
    })

    if (profileError) {
      setServerError(profileError.message)
      setLoading(false)
      return
    }

    // 3. Create empty customer profile (stores preferences even before survey)
    await supabase.from('customer_profiles').insert({ user_id: userId })

    // 4. Log compliance document acceptance
    await supabase.from('compliance_documents').insert({
      user_id: userId,
      document_type: 'terms',
      document_version: '1.0',
    })

    // Fetch the newly created profile before navigating so ProtectedRoute
    // doesn't see a null profile and spin forever.
    await refreshProfile(userId)

    navigate('/signup/survey', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🌿</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-1 text-sm text-gray-500">Start discovering local vendors</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {serverError && <Alert type="error" className="mb-4">{serverError}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                value={form.firstName}
                onChange={set('firstName')}
                error={errors.firstName}
                required
              />
              <Input
                label="Last name"
                value={form.lastName}
                onChange={set('lastName')}
                error={errors.lastName}
                required
              />
            </div>
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              placeholder="At least 8 characters"
              required
            />
            <Input
              label="Confirm password"
              type="password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              error={errors.confirmPassword}
              placeholder="••••••••"
              required
            />

            <p className="text-xs text-gray-500">
              By creating an account you agree to our{' '}
              <a href="#" className="text-brand-600 hover:underline">Terms of Service</a>{' '}
              and{' '}
              <a href="#" className="text-brand-600 hover:underline">Privacy Policy</a>.
            </p>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Create account
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
