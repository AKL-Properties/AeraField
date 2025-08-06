import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMap } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
      padding: '1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '2rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '20px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Logo/Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '60px',
            height: '60px',
            margin: '0 auto 1rem',
            background: 'linear-gradient(135deg, #00bcd4, #26a69a)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem'
          }}>
<FontAwesomeIcon icon={faMap} />
          </div>
          <h1 style={{
            fontSize: '1.8rem',
            fontWeight: '600',
            background: 'linear-gradient(135deg, #00bcd4, #26a69a)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: '0 0 0.5rem 0'
          }}>
            AeraField
          </h1>
          <p style={{
            color: '#b0b0b0',
            fontSize: '0.9rem',
            margin: 0
          }}>
            Field Navigation Portal
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                color: '#ffffff',
                outline: 'none',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#00bcd4'
                e.target.style.boxShadow = '0 0 0 3px rgba(0, 188, 212, 0.2)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                color: '#ffffff',
                outline: 'none',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#00bcd4'
                e.target.style.boxShadow = '0 0 0 3px rgba(0, 188, 212, 0.2)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              marginBottom: '1rem',
              background: 'rgba(244, 67, 54, 0.1)',
              border: '1px solid rgba(244, 67, 54, 0.3)',
              borderRadius: '8px',
              color: '#f44336',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: '600',
              background: loading 
                ? 'rgba(0, 188, 212, 0.3)' 
                : 'linear-gradient(135deg, #00bcd4, #26a69a)',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(0, 188, 212, 0.3)',
              transform: loading ? 'none' : 'translateY(0)',
              opacity: loading ? 0.7 : 1
            }}
            onMouseDown={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(2px)'
                e.target.style.boxShadow = '0 2px 10px rgba(0, 188, 212, 0.4)'
              }
            }}
            onMouseUp={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = '0 4px 15px rgba(0, 188, 212, 0.3)'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = '0 4px 15px rgba(0, 188, 212, 0.3)'
              }
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          padding: '1rem 0',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#888',
          fontSize: '0.85rem'
        }}>
          Secure access for Aera personnel only
        </div>
      </div>
    </div>
  )
}

export default Login