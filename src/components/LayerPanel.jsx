import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLayerGroup, faFolder } from '@fortawesome/free-solid-svg-icons'
import { useGeoJSONLoader } from '../hooks/useGeoJSONLoader'

const LayerPanel = ({ onClose, mapRef }) => {
  const { geoJsonData, loading } = useGeoJSONLoader()
  const [layerVisibility, setLayerVisibility] = useState({})

  // Initialize all layers as visible
  useEffect(() => {
    const initialVisibility = {}
    geoJsonData.forEach(({ name }) => {
      initialVisibility[name] = true
    })
    setLayerVisibility(initialVisibility)
  }, [geoJsonData])

  const toggleLayer = (layerName) => {
    const newVisibility = !layerVisibility[layerName]
    setLayerVisibility(prev => ({
      ...prev,
      [layerName]: newVisibility
    }))

    // Toggle layer on map if mapRef is provided
    if (mapRef && mapRef.toggleLayer) {
      mapRef.toggleLayer(layerName, newVisibility)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          bottom: '80px',
          left: '1rem',
          right: '1rem',
          maxHeight: '60vh',
          background: 'rgba(26, 26, 26, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          zIndex: 2001,
          overflow: 'hidden',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 1.5rem 1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h3 style={{
            margin: 0,
            color: '#ffffff',
            fontSize: '1.2rem',
            fontWeight: '600'
          }}>
<FontAwesomeIcon icon={faLayerGroup} style={{ marginRight: '8px' }} />Layer Manager
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              transition: 'all 0.2s ease'
            }}
            onTouchStart={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)'
              e.target.style.transform = 'scale(0.9)'
            }}
            onTouchEnd={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.1)'
              e.target.style.transform = 'scale(1)'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '1rem 1.5rem 1.5rem',
          maxHeight: 'calc(60vh - 80px)',
          overflowY: 'auto'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              color: '#00bcd4'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '2px solid rgba(0, 188, 212, 0.3)',
                borderTop: '2px solid #00bcd4',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginRight: '0.5rem'
              }} />
              Loading layers...
            </div>
          ) : geoJsonData.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#888'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem', color: '#00bcd4' }}>
<FontAwesomeIcon icon={faFolder} />
              </div>
              <p>No GeoJSON layers found.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Add .geojson files to the /data directory to see them here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {geoJsonData.map(({ name, filename }) => (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div>
                    <h4 style={{
                      margin: '0 0 0.25rem 0',
                      color: '#ffffff',
                      fontSize: '1rem',
                      fontWeight: '500',
                      textTransform: 'capitalize'
                    }}>
                      {name}
                    </h4>
                    <p style={{
                      margin: 0,
                      color: '#888',
                      fontSize: '0.8rem'
                    }}>
                      {filename}
                    </p>
                  </div>

                  <button
                    onClick={() => toggleLayer(name)}
                    style={{
                      background: layerVisibility[name] 
                        ? 'linear-gradient(135deg, #00bcd4, #26a69a)'
                        : 'rgba(255, 255, 255, 0.1)',
                      border: layerVisibility[name] 
                        ? 'none'
                        : '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '20px',
                      padding: '0.5rem 1rem',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      minWidth: '60px',
                      transition: 'all 0.3s ease',
                      boxShadow: layerVisibility[name] 
                        ? '0 2px 10px rgba(0, 188, 212, 0.3)'
                        : 'none'
                    }}
                    onTouchStart={(e) => {
                      e.target.style.transform = 'scale(0.95)'
                    }}
                    onTouchEnd={(e) => {
                      e.target.style.transform = 'scale(1)'
                    }}
                  >
                    {layerVisibility[name] ? 'ON' : 'OFF'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <style>{`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  )
}

export default LayerPanel