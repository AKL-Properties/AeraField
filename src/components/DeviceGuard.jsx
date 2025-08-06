import { useState, useEffect } from 'react'

const DeviceGuard = ({ children }) => {
  const [isValidDevice, setIsValidDevice] = useState(true)

  useEffect(() => {
    const checkScreenSize = () => {
      const screenWidth = window.innerWidth
      setIsValidDevice(screenWidth <= 1024)
    }

    // Check on initial load
    checkScreenSize()

    // Listen for window resize
    window.addEventListener('resize', checkScreenSize)

    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  if (!isValidDevice) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        color: '#ffffff',
        textAlign: 'center',
        padding: '2rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          maxWidth: '500px',
          padding: '3rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '20px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 2rem',
            background: 'linear-gradient(135deg, #00bcd4, #26a69a)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem'
          }}>
            📱
          </div>
          <h1 style={{
            fontSize: '1.8rem',
            marginBottom: '1rem',
            fontWeight: '600',
            background: 'linear-gradient(135deg, #00bcd4, #26a69a)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            AeraField
          </h1>
          <p style={{
            fontSize: '1.1rem',
            lineHeight: '1.6',
            color: '#e0e0e0',
            marginBottom: '1.5rem'
          }}>
            AeraField is available on mobile and tablet devices only. Please switch to a supported device.
          </p>
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            fontSize: '2rem'
          }}>
            <span>📱</span>
            <span>📱</span>
          </div>
        </div>
      </div>
    )
  }

  return children
}

export default DeviceGuard