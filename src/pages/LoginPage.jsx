import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import Alert from '../components/Alert.jsx'

function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function handleChange(event) {
    setForm(prev => ({ ...prev, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!form.email || !form.password) {
      setError('Please enter email and password.')
      return
    }
    if (!form.email.includes('@')) {
      setError('Please enter a valid email.')
      return
    }

    try {
      const result = await api.auth.login({ email: form.email, password: form.password })
      onLogin(result.user, result.token)
      navigate('/app/dashboard')
    } catch (err) {
      setError(err?.message || 'Login failed. Please try again.')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Login</h1>
        {error && <Alert>{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={handleChange} />
          </label>
          <label>
            Password
            <input name="password" type="password" value={form.password} onChange={handleChange} />
          </label>
          <button type="submit">Login</button>
        </form>
        <div className="auth-footer">
          Don't have an account? <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
