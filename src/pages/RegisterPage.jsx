import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import Alert from '../components/Alert.jsx'

function RegisterPage({ onRegister }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phoneNumber: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function handleChange(event) {
    setForm(prev => ({ ...prev, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!form.fullName || !form.email || !form.password) {
      setError('Please fill in all required fields.')
      return
    }
    if (!form.email.includes('@')) {
      setError('Please enter a valid email.')
      return
    }

    try {
      const result = await api.auth.register({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phoneNumber: form.phoneNumber,
      })
      onRegister(result.user, result.token)
      navigate('/app/dashboard')
    } catch (err) {
      setError(err?.message || 'Registration failed. Please try again.')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Register</h1>
        {error && <Alert>{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <label>
            Full name
            <input name="fullName" value={form.fullName} onChange={handleChange} />
          </label>
          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={handleChange} />
          </label>
          <label>
            Password
            <input name="password" type="password" value={form.password} onChange={handleChange} />
          </label>
          <label>
            Phone number
            <input name="phoneNumber" value={form.phoneNumber} onChange={handleChange} />
          </label>
          <button type="submit">Create account</button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
