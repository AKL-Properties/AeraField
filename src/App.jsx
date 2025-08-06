import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMap, faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { AuthProvider, useAuth } from './hooks/useAuth'
import DeviceGuard from './components/DeviceGuard'
import Login from './components/Login'
import BottomNav from './components/BottomNav'
import MapView from './components/MapView'
import LayerPanel from './components/LayerPanel'
import LoadingScreen from './components/LoadingScreen'

const AppContent = () => {
  const { user, loading, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('map')
  const [showLayerPanel, setShowLayerPanel] = useState(false)
  const [mapRef, setMapRef] = useState(null)
  const [showLoadingScreen, setShowLoadingScreen] = useState(true)
  const [authInitialized, setAuthInitialized] = useState(false)

  useEffect(() => {
    if (!loading) {
      setAuthInitialized(true)
    }
  }, [loading])

  const handleLoadingComplete = () => {
    setShowLoadingScreen(false)
  }

  const handleLocateMe = () => {
    if (mapRef) {
      mapRef.locateUser()
    }
  }

  const handleTabChange = (tab) => {
    if (tab === 'layers') {
      setShowLayerPanel(true)
    } else {
      setShowLayerPanel(false)
      setActiveTab(tab)
    }
  }

  if (showLoadingScreen) {
    return <LoadingScreen onComplete={handleLoadingComplete} />
  }

  if (!user) {
    return <Login />
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div style={{
            padding: '2rem 1rem',
            paddingBottom: '100px',
            background: '#1a1a1a',
            minHeight: '100vh',
            color: '#ffffff'
          }}>
            <h1 style={{
              fontSize: '2rem',
              marginBottom: '1rem',
              background: 'linear-gradient(135deg, #00bcd4, #26a69a)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Welcome to AeraField
            </h1>
            <p style={{ color: '#b0b0b0', marginBottom: '2rem' }}>
              Field navigation and geospatial data interaction platform
            </p>
            
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '1.5rem',
              marginBottom: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <h3 style={{ marginBottom: '0.5rem', color: '#00bcd4' }}>Quick Actions</h3>
              <button
                onClick={() => setActiveTab('map')}
                style={{
                  background: 'linear-gradient(135deg, #00bcd4, #26a69a)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '1rem',
                  color: '#ffffff',
                  cursor: 'pointer',
                  width: '100%',
                  marginBottom: '0.5rem',
                  fontWeight: '600'
                }}
              >
<FontAwesomeIcon icon={faMap} style={{ marginRight: '8px' }} />Open Map View
              </button>
              <button
                onClick={() => setShowLayerPanel(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '1rem',
                  color: '#ffffff',
                  cursor: 'pointer',
                  width: '100%',
                  fontWeight: '600'
                }}
              >
<FontAwesomeIcon icon={faLayerGroup} style={{ marginRight: '8px' }} />Manage Layers
              </button>
            </div>

            <button
              onClick={signOut}
              style={{
                background: 'rgba(244, 67, 54, 0.2)',
                border: '1px solid rgba(244, 67, 54, 0.5)',
                borderRadius: '12px',
                padding: '1rem',
                color: '#f44336',
                cursor: 'pointer',
                width: '100%',
                fontWeight: '600'
              }}
            >
              Sign Out
            </button>
          </div>
        )
      case 'map':
        return <MapView ref={setMapRef} />
      case 'settings':
        return (
          <div style={{
            padding: '2rem 1rem',
            paddingBottom: '100px',
            background: '#1a1a1a',
            minHeight: '100vh',
            color: '#ffffff'
          }}>
            <h2 style={{ marginBottom: '2rem', color: '#00bcd4' }}>Settings</h2>
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '1.5rem',
              marginBottom: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <p style={{ marginBottom: '1rem' }}>
                Logged in as: <strong style={{ color: '#00bcd4' }}>{user.email}</strong>
              </p>
              <button
                onClick={signOut}
                style={{
                  background: 'rgba(244, 67, 54, 0.2)',
                  border: '1px solid rgba(244, 67, 54, 0.5)',
                  borderRadius: '12px',
                  padding: '1rem',
                  color: '#f44336',
                  cursor: 'pointer',
                  width: '100%',
                  fontWeight: '600'
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )
      default:
        return <MapView ref={setMapRef} />
    }
  }

  return (
    <div style={{ height: '100vh', background: '#1a1a1a' }}>
      {renderContent()}
      
      {showLayerPanel && (
        <LayerPanel onClose={() => setShowLayerPanel(false)} mapRef={mapRef} />
      )}
      
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLocateMe={handleLocateMe}
      />
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

const App = () => {
  return (
    <AuthProvider>
      <DeviceGuard>
        <AppContent />
      </DeviceGuard>
    </AuthProvider>
  )
}

export default App