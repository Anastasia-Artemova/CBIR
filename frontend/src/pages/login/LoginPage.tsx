import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/session'
import './LoginPage.css'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await login({ email: email.trim(), password })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError('Incorrect email or password.')
      } else {
        setError(err instanceof Error ? err.message : 'Sign-in failed. Try again.')
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="login">
      <aside className="login__panel" aria-hidden="true">
        <div className="login__brand">
          <span className="login__mark" />
          <span>Radiomics Search</span>
        </div>
        <div className="login__scan">
          <div className="login__ring login__ring--outer" />
          <div className="login__ring login__ring--mid" />
          <div className="login__lesion" />
          <div className="login__crosshair" />
        </div>
        <p className="login__tagline">
          Find similar tumours across studies by combining radiomic features with learned image
          embeddings.
        </p>
      </aside>

      <main className="login__main">
        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <h1>Sign in</h1>
          <p className="login__subtitle">Access is limited to authorised accounts.</p>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </label>

          <label className="field">
            <span>Password</span>
            <div className="field__password">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
              <button
                type="button"
                className="field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="login__submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="login__note">No account? Ask your administrator for access.</p>
        </form>
      </main>
    </div>
  )
}
