<template>
  <div class="map-container">
    <div 
      ref="mapContainer" 
      class="leaflet-map"
      @touchstart="handleMapTouchStart"
      @touchmove="handleMapTouchMove" 
      @touchend="handleMapTouchEnd"
    ></div>
    
    <button
      @click="handleGPSClick"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
      :class="['gps-fab', { 'tracking': isTracking }]"
    >
      <font-awesome-icon :icon="isTracking ? 'stop' : 'location-crosshairs'" />
    </button>

    <div v-if="loading" class="loading-indicator">
      Loading layers...
    </div>

    <div v-if="error" class="error-indicator">
      Error loading layers
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, inject } from 'vue'
import L from 'leaflet'
import { useGeoJSONLoader } from '../composables/useGeoJSONLoader'

export default {
  name: 'MapView',
  props: {
    mapRef: Object
  },
  setup(props) {
    const mapContainer = ref(null)
    const mapInstance = ref(null)
    const layers = ref(new Map())
    const { geoJsonData, loading, error } = useGeoJSONLoader()
    
    // GPS tracking variables
    const isTracking = ref(false)
    const watchId = ref(null)
    const trackPoints = ref([])
    const currentRoute = ref(null)
    
    // Touch gesture variables
    const touchGestures = ref({
      isZooming: false,
      initialDistance: 0,
      initialZoom: 0,
      touches: []
    })
    
    const mapInstanceProvider = inject('mapInstance', null)
    if (mapInstanceProvider) {
      mapInstanceProvider.value = mapInstance
    }

    const initializeMap = () => {
      if (!mapContainer.value) return

      const map = L.map(mapContainer.value, {
        center: [14.5995, 120.9842],
        zoom: 13,
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: true,
        tapTolerance: 15,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 60
      })

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 18,
        subdomains: ['server', 'services']
      }).addTo(map)


      map.on('locationfound', (e) => {
        const radius = e.accuracy / 2
        
        map.eachLayer((layer) => {
          if (layer.options && layer.options.className === 'location-marker') {
            map.removeLayer(layer)
          }
        })

        L.marker(e.latlng, {
          className: 'location-marker'
        }).addTo(map)
          .bindPopup(`You are within ${radius} meters of this point`)
          .openPopup()

        L.circle(e.latlng, radius, {
          className: 'location-marker',
          color: '#1394b9',
          fillColor: '#1394b9',
          fillOpacity: 0.1,
          weight: 2
        }).addTo(map)
      })

      map.on('locationerror', (e) => {
        console.warn('Location access denied or failed:', e.message)
      })

      mapInstance.value = map
    }

    const loadGeoJSONLayers = () => {
      if (!mapInstance.value || !geoJsonData.value.length) return

      layers.value.forEach((layer) => {
        mapInstance.value.removeLayer(layer)
      })
      layers.value.clear()

      let aeraLayer = null

      geoJsonData.value.forEach(({ name, data }) => {
        const layer = L.geoJSON(data, {
          style: (feature) => {
            // Use symbology field if available, otherwise fallback to default
            const symbology = feature.properties?.symbology
            if (symbology) {
              return {
                color: symbology.outline || '#000000',
                weight: symbology.stroke_width || 1,
                opacity: symbology.opacity || 1,
                fillColor: symbology.fill || 'transparent',
                fillOpacity: symbology.fill && symbology.fill !== 'transparent' ? (symbology.opacity || 0.7) : 0
              }
            }
            // Default styling for features without symbology
            return {
              color: '#1394b9',
              weight: 2,
              opacity: 1,
              fillColor: 'transparent',
              fillOpacity: 0
            }
          },
          onEachFeature: (feature, layer) => {
            if (feature.properties) {
              const popupContent = Object.entries(feature.properties)
                .map(([key, value]) => `
                  <div class="popup-attribute">
                    <span class="key">${key}:</span> 
                    <span class="value">${value || 'N/A'}</span>
                  </div>
                `).join('')

              layer.bindPopup(`
                <div class="popup-card">
                  <h3>${name}</h3>
                  ${popupContent}
                </div>
              `, {
                maxWidth: 300,
                className: 'custom-popup'
              })
            }
          }
        })

        layers.value.set(name, layer)
        layer.addTo(mapInstance.value)

        // Check if this is the Aera layer for auto-focus
        if (name.toLowerCase() === 'aera') {
          aeraLayer = layer
        }
      })

      // Auto-focus on Aera.geojson layer if it exists
      if (aeraLayer && mapInstance.value) {
        const bounds = aeraLayer.getBounds()
        if (bounds.isValid()) {
          mapInstance.value.fitBounds(bounds, {
            padding: [20, 20],
            maxZoom: 16
          })
        }
      }
    }

    const checkLocationPermissions = async () => {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this device')
      }

      // Check if running on HTTPS (required for Safari and other browsers)
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        throw new Error('Geolocation requires HTTPS connection. Please use HTTPS.')
      }

      // For Safari iOS, we need to handle permissions differently
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      
      // Check permissions if available (not reliable on Safari iOS)
      if (navigator.permissions && !isSafari) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          if (permission.state === 'denied') {
            throw new Error('Location permission denied. Please enable location services in your browser settings.')
          }
        } catch (e) {
          console.warn('Could not check location permissions:', e)
        }
      }
      
      return new Promise((resolve, reject) => {
        const options = {
          enableHighAccuracy: true,
          timeout: isIOS ? 15000 : 10000, // iOS needs more time
          maximumAge: isIOS ? 300000 : 60000 // iOS can use slightly older positions
        }

        // For Safari iOS, try multiple attempts with different options
        if (isSafari && isIOS) {
          let attempts = 0
          const maxAttempts = 3
          
          const tryGetPosition = () => {
            attempts++
            const currentOptions = {
              ...options,
              enableHighAccuracy: attempts === 1, // First try with high accuracy
              timeout: attempts === 1 ? 15000 : 5000, // Reduce timeout on retries
              maximumAge: attempts === 1 ? 300000 : 0 // Fresh position on retries
            }

            navigator.geolocation.getCurrentPosition(
              (position) => {
                resolve(position)
              },
              (error) => {
                console.warn(`Geolocation attempt ${attempts} failed:`, error)
                
                if (attempts < maxAttempts) {
                  // Try again with different settings
                  setTimeout(tryGetPosition, 1000)
                } else {
                  // All attempts failed, return appropriate error
                  switch (error.code) {
                    case error.PERMISSION_DENIED:
                      reject(new Error('Location permission denied. Please enable location services in Settings > Privacy & Security > Location Services > Safari Websites.'))
                      break
                    case error.POSITION_UNAVAILABLE:
                      reject(new Error('GPS signal unavailable. Please ensure you are outdoors with a clear view of the sky.'))
                      break
                    case error.TIMEOUT:
                      reject(new Error('GPS timeout. Please check your internet connection and try again.'))
                      break
                    default:
                      reject(new Error('GPS error. Please ensure location services are enabled and try again.'))
                      break
                  }
                }
              },
              currentOptions
            )
          }
          
          tryGetPosition()
        } else {
          // Standard implementation for other browsers
          navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            (error) => {
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  reject(new Error('Location permission denied. Please enable location services in your browser settings.'))
                  break
                case error.POSITION_UNAVAILABLE:
                  reject(new Error('GPS signal unavailable. Please ensure you are outdoors with a clear view of the sky.'))
                  break
                case error.TIMEOUT:
                  reject(new Error('GPS timeout. Please check your internet connection and try again.'))
                  break
                default:
                  reject(new Error('GPS error. Please ensure location services are enabled and try again.'))
                  break
              }
            },
            options
          )
        }
      })
    }

    const generateGPXString = (points) => {
      const startTime = points.length > 0 ? new Date(points[0].timestamp) : new Date()
      const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="AeraField" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>AeraField Tracked Route</name>
    <time>${startTime.toISOString()}</time>
  </metadata>
  <trk>
    <name>Route ${startTime.toISOString().split('T')[0]}</name>
    <trkseg>`
      
      const trackPoints = points.map(point => {
        const time = new Date(point.timestamp).toISOString()
        return `      <trkpt lat="${point.lat}" lon="${point.lng}">
        <ele>${point.altitude || 0}</ele>
        <time>${time}</time>
      </trkpt>`
      }).join('\n')
      
      const gpxFooter = `    </trkseg>
  </trk>
</gpx>`
      
      return gpxHeader + '\n' + trackPoints + '\n' + gpxFooter
    }

    const downloadGPXFile = (gpxString) => {
      const blob = new Blob([gpxString], { type: 'application/gpx+xml' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
      link.download = `tracked_route_${timestamp}.gpx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
      return `tracked_route_${timestamp}.gpx`
    }

    const loadGPXToMap = (gpxString, filename) => {
      try {
        const parser = new DOMParser()
        const gpxDoc = parser.parseFromString(gpxString, 'text/xml')
        const trackPoints = gpxDoc.querySelectorAll('trkpt')
        
        if (trackPoints.length === 0) return
        
        const routeCoords = Array.from(trackPoints).map(point => [
          parseFloat(point.getAttribute('lat')),
          parseFloat(point.getAttribute('lon'))
        ])
        
        const routeLayer = L.polyline(routeCoords, {
          color: '#ff6b35',
          weight: 4,
          opacity: 0.8
        }).addTo(mapInstance.value)
        
        const layerName = filename.replace('.gpx', '')
        layers.value.set(layerName, routeLayer)
        
        mapInstance.value.fitBounds(routeLayer.getBounds(), {
          padding: [20, 20]
        })
        
        console.log(`Loaded GPX route: ${layerName}`)
      } catch (error) {
        console.error('Error loading GPX to map:', error)
      }
    }

    const startTracking = async () => {
      try {
        await checkLocationPermissions()
        
        trackPoints.value = []
        isTracking.value = true
        
        if (currentRoute.value) {
          mapInstance.value.removeLayer(currentRoute.value)
        }
        
        watchId.value = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, altitude } = position.coords
            const timestamp = position.timestamp
            
            const newPoint = {
              lat: latitude,
              lng: longitude,
              altitude: altitude,
              timestamp: timestamp
            }
            
            trackPoints.value.push(newPoint)
            
            if (trackPoints.value.length === 1) {
              mapInstance.value.setView([latitude, longitude], 16)
            }
            
            if (trackPoints.value.length > 1) {
              if (currentRoute.value) {
                mapInstance.value.removeLayer(currentRoute.value)
              }
              
              const routeCoords = trackPoints.value.map(point => [point.lat, point.lng])
              currentRoute.value = L.polyline(routeCoords, {
                color: '#ff6b35',
                weight: 4,
                opacity: 0.8
              }).addTo(mapInstance.value)
            }
            
            L.marker([latitude, longitude], {
              className: 'current-location-marker'
            }).addTo(mapInstance.value)
            
            mapInstance.value.eachLayer((layer) => {
              if (layer.options && layer.options.className === 'current-location-marker' && layer !== currentRoute.value) {
                if (trackPoints.value.length > 5) {
                  mapInstance.value.removeLayer(layer)
                }
              }
            })
          },
          (error) => {
            console.error('GPS tracking error:', error)
            stopTracking()
          },
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 5000
          }
        )
        
        console.log('GPS tracking started')
      } catch (error) {
        console.error('Failed to start tracking:', error)
        alert(`GPS Error: ${error.message}`)
        isTracking.value = false
      }
    }

    const stopTracking = () => {
      if (watchId.value) {
        navigator.geolocation.clearWatch(watchId.value)
        watchId.value = null
      }
      
      isTracking.value = false
      
      if (trackPoints.value.length > 0) {
        const gpxString = generateGPXString(trackPoints.value)
        const filename = downloadGPXFile(gpxString)
        
        setTimeout(() => {
          loadGPXToMap(gpxString, filename)
        }, 500)
        
        console.log(`Stopped tracking. Generated ${trackPoints.value.length} track points`)
      }
      
      trackPoints.value = []
    }

    const handleGPSClick = () => {
      if (isTracking.value) {
        stopTracking()
      } else {
        startTracking()
      }
    }

    const locateUser = () => {
      if (mapInstance.value) {
        mapInstance.value.locate({
          setView: true,
          maxZoom: 16,
          enableHighAccuracy: true
        })
      }
    }

    const toggleLayer = (layerName, visible) => {
      const layer = layers.value.get(layerName)
      if (layer && mapInstance.value) {
        if (visible) {
          mapInstance.value.addLayer(layer)
        } else {
          mapInstance.value.removeLayer(layer)
        }
      }
    }

    const handleTouchStart = (event) => {
      event.target.style.transform = 'scale(0.9)'
      event.target.style.boxShadow = '0 2px 15px rgba(19, 148, 185, 0.6)'
    }

    const handleTouchEnd = (event) => {
      event.target.style.transform = 'scale(1)'
      event.target.style.boxShadow = '0 4px 20px rgba(19, 148, 185, 0.4)'
    }

    const handleMouseDown = (event) => {
      event.target.style.transform = 'scale(0.9)'
    }

    const handleMouseUp = (event) => {
      event.target.style.transform = 'scale(1)'
    }

    const handleMouseLeave = (event) => {
      event.target.style.transform = 'scale(1)'
    }

    // Touch gesture functions
    const getDistance = (touch1, touch2) => {
      const dx = touch1.clientX - touch2.clientX
      const dy = touch1.clientY - touch2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const handleMapTouchStart = (event) => {
      if (event.touches.length === 2) {
        event.preventDefault()
        touchGestures.value.isZooming = true
        touchGestures.value.initialDistance = getDistance(event.touches[0], event.touches[1])
        touchGestures.value.initialZoom = mapInstance.value.getZoom()
        touchGestures.value.touches = [...event.touches]
      }
    }

    const handleMapTouchMove = (event) => {
      if (touchGestures.value.isZooming && event.touches.length === 2) {
        event.preventDefault()
        
        const currentDistance = getDistance(event.touches[0], event.touches[1])
        const distanceRatio = currentDistance / touchGestures.value.initialDistance
        
        // Calculate new zoom level with smooth scaling
        const zoomDelta = Math.log2(distanceRatio)
        const newZoom = Math.max(
          mapInstance.value.getMinZoom(),
          Math.min(
            mapInstance.value.getMaxZoom(),
            touchGestures.value.initialZoom + zoomDelta
          )
        )
        
        // Get center point between two fingers
        const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2
        const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2
        const centerPoint = mapInstance.value.containerPointToLatLng([centerX, centerY])
        
        // Apply zoom with center point
        mapInstance.value.setZoomAround(centerPoint, newZoom, { animate: false })
      }
    }

    const handleMapTouchEnd = (event) => {
      if (touchGestures.value.isZooming) {
        touchGestures.value.isZooming = false
        touchGestures.value.initialDistance = 0
        touchGestures.value.initialZoom = 0
        touchGestures.value.touches = []
      }
    }

    onMounted(() => {
      initializeMap()
      
      // Add touch event listeners for custom pinch-to-zoom
      if (mapContainer.value) {
        mapContainer.value.addEventListener('touchstart', handleMapTouchStart, { passive: false })
        mapContainer.value.addEventListener('touchmove', handleMapTouchMove, { passive: false })
        mapContainer.value.addEventListener('touchend', handleMapTouchEnd, { passive: false })
      }
    })

    onUnmounted(() => {
      // Stop GPS tracking if active
      if (isTracking.value) {
        stopTracking()
      }
      
      // Remove touch event listeners
      if (mapContainer.value) {
        mapContainer.value.removeEventListener('touchstart', handleMapTouchStart)
        mapContainer.value.removeEventListener('touchmove', handleMapTouchMove)
        mapContainer.value.removeEventListener('touchend', handleMapTouchEnd)
      }
      
      if (mapInstance.value) {
        mapInstance.value.remove()
        mapInstance.value = null
      }
    })

    watch(geoJsonData, () => {
      loadGeoJSONLayers()
    }, { deep: true })

    // Expose methods for external access
    if (props.mapRef) {
      props.mapRef.locateUser = locateUser
      props.mapRef.toggleLayer = toggleLayer
    }

    return {
      mapContainer,
      loading,
      error,
      isTracking,
      locateUser,
      handleGPSClick,
      handleTouchStart,
      handleTouchEnd,
      handleMouseDown,
      handleMouseUp,
      handleMouseLeave,
      handleMapTouchStart,
      handleMapTouchMove,
      handleMapTouchEnd
    }
  }
}
</script>

<style scoped>
.map-container {
  position: relative;
  height: 100vh;
  width: 100%;
}

.leaflet-map {
  height: 100%;
  width: 100%;
  background: #1394b9;
}

.gps-fab {
  position: absolute;
  bottom: 100px;
  right: 16px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1394b9, #26a6c4);
  border: none;
  color: #fcfcfc;
  font-size: 1.5rem;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(19, 148, 185, 0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.gps-fab.tracking {
  background: linear-gradient(135deg, #ff6b35, #ff8c69);
  box-shadow: 0 4px 20px rgba(255, 107, 53, 0.4);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 4px 20px rgba(255, 107, 53, 0.4);
  }
  50% {
    box-shadow: 0 4px 25px rgba(255, 107, 53, 0.8);
  }
  100% {
    box-shadow: 0 4px 20px rgba(255, 107, 53, 0.4);
  }
}

.loading-indicator {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: #1394b9;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  z-index: 1000;
}

.error-indicator {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(244, 67, 54, 0.9);
  color: #fcfcfc;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  z-index: 1000;
}
</style>

<style>
.leaflet-popup-content-wrapper {
  border-radius: 12px !important;
  border: none !important;
  background: #fcfcfc !important;
}

.leaflet-popup-tip {
  background: #fcfcfc !important;
}


.popup-card {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 8px;
  max-width: 250px;
  background: #fcfcfc;
  border-radius: 8px;
  color: #1394b9;
}

.popup-card h3 {
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid #1394b9;
  color: #1394b9;
  font-size: 14px;
}

.popup-attribute {
  margin-bottom: 8px;
}

.popup-attribute .key {
  color: #94a3b8;
  font-weight: 500;
}

.popup-attribute .value {
  color: #1394b9;
}
</style>