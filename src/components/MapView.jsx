import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import L from 'leaflet'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationCrosshairs } from '@fortawesome/free-solid-svg-icons'
import { useGeoJSONLoader } from '../hooks/useGeoJSONLoader'

const MapView = forwardRef((props, ref) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layersRef = useRef(new Map())
  const { geoJsonData, loading, error } = useGeoJSONLoader()

  useImperativeHandle(ref, () => ({
    locateUser: () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.locate({
          setView: true,
          maxZoom: 16,
          enableHighAccuracy: true
        })
      }
    },
    toggleLayer: (layerName, visible) => {
      const layer = layersRef.current.get(layerName)
      if (layer && mapInstanceRef.current) {
        if (visible) {
          mapInstanceRef.current.addLayer(layer)
        } else {
          mapInstanceRef.current.removeLayer(layer)
        }
      }
    }
  }))

  useEffect(() => {
    if (!mapRef.current) return

    // Initialize map
    const map = L.map(mapRef.current, {
      center: [14.5995, 120.9842], // Manila, Philippines as default
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
      tap: true,
      tapTolerance: 15
    })

    // Add ESRI basemap (Dark Canvas without labels)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 18,
      subdomains: ['server', 'services']
    }).addTo(map)

    // Add zoom control to bottom right
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map)

    // Location found handler
    map.on('locationfound', (e) => {
      const radius = e.accuracy / 2
      
      // Remove existing location marker if any
      map.eachLayer((layer) => {
        if (layer.options && layer.options.className === 'location-marker') {
          map.removeLayer(layer)
        }
      })

      // Add location marker
      L.marker(e.latlng, {
        className: 'location-marker'
      }).addTo(map)
        .bindPopup(`You are within ${radius} meters of this point`)
        .openPopup()

      // Add accuracy circle
      L.circle(e.latlng, radius, {
        className: 'location-marker',
        color: '#00bcd4',
        fillColor: '#00bcd4',
        fillOpacity: 0.1,
        weight: 2
      }).addTo(map)
    })

    // Location error handler
    map.on('locationerror', (e) => {
      console.warn('Location access denied or failed:', e.message)
      // You could show a toast notification here
    })

    mapInstanceRef.current = map

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Load GeoJSON layers
  useEffect(() => {
    console.log('MapView: geoJsonData updated:', geoJsonData)
    if (!mapInstanceRef.current || !geoJsonData.length) {
      console.log('MapView: Map not ready or no data yet')
      return
    }

    // Clear existing layers
    layersRef.current.forEach((layer) => {
      mapInstanceRef.current.removeLayer(layer)
    })
    layersRef.current.clear()

    // Add new layers
    geoJsonData.forEach(({ name, data }) => {
      console.log(`MapView: Adding layer "${name}" with ${data.features?.length || 0} features`)
      const layer = L.geoJSON(data, {
        style: {
          color: '#00bcd4',
          weight: 2,
          opacity: 1,
          fillColor: 'transparent',
          fillOpacity: 0
        },
        onEachFeature: (feature, layer) => {
          if (feature.properties) {
            // Create popup content
            const popupContent = Object.entries(feature.properties)
              .map(([key, value]) => `
                <div style="margin-bottom: 8px;">
                  <strong style="color: #00bcd4;">${key}:</strong> 
                  <span style="color: #333;">${value || 'N/A'}</span>
                </div>
              `).join('')

            layer.bindPopup(`
              <div style="
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 8px;
                max-width: 250px;
                background: #ffffff;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              ">
                <h4 style="
                  margin: 0 0 12px 0;
                  padding-bottom: 8px;
                  border-bottom: 2px solid #00bcd4;
                  color: #333;
                  font-size: 14px;
                ">${name}</h4>
                ${popupContent}
              </div>
            `, {
              maxWidth: 300,
              className: 'custom-popup'
            })
          }
        }
      })

      layersRef.current.set(name, layer)
      layer.addTo(mapInstanceRef.current)
    })

  }, [geoJsonData])

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <div
        ref={mapRef}
        style={{
          height: '100%',
          width: '100%',
          background: '#1a1a1a'
        }}
      />
      
      {/* Floating GPS Button */}
      <button
        onClick={() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.locate({
              setView: true,
              maxZoom: 16,
              enableHighAccuracy: true
            })
          }
        }}
        style={{
          position: 'absolute',
          bottom: '100px',
          right: '16px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #00bcd4, #26a69a)',
          border: 'none',
          color: '#ffffff',
          fontSize: '1.5rem',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0, 188, 212, 0.4)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease'
        }}
        onTouchStart={(e) => {
          e.target.style.transform = 'scale(0.9)'
          e.target.style.boxShadow = '0 2px 15px rgba(0, 188, 212, 0.6)'
        }}
        onTouchEnd={(e) => {
          e.target.style.transform = 'scale(1)'
          e.target.style.boxShadow = '0 4px 20px rgba(0, 188, 212, 0.4)'
        }}
        onMouseDown={(e) => {
          e.target.style.transform = 'scale(0.9)'
        }}
        onMouseUp={(e) => {
          e.target.style.transform = 'scale(1)'
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)'
        }}
      >
<FontAwesomeIcon icon={faLocationCrosshairs} />
      </button>

      {/* Loading indicator */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#00bcd4',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '0.9rem',
          zIndex: 1000
        }}>
          Loading layers...
        </div>
      )}

      {/* Error indicator */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(244, 67, 54, 0.9)',
          color: '#ffffff',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '0.9rem',
          zIndex: 1000
        }}>
          Error loading layers
        </div>
      )}

      <style>{`
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          border: none !important;
        }
        .leaflet-popup-tip {
          display: none !important;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
        }
        .leaflet-control-zoom a {
          background: rgba(26, 26, 26, 0.9) !important;
          color: #00bcd4 !important;
          border: none !important;
          border-radius: 8px !important;
          margin: 2px !important;
          backdrop-filter: blur(10px) !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(0, 188, 212, 0.2) !important;
        }
      `}</style>
    </div>
  )
})

MapView.displayName = 'MapView'

export default MapView