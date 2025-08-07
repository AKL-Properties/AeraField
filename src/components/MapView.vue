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
      :class="['gps-fab', { 'locating': isLocating, 'tracking': isTracking, 'disabled': isTracking }]"
    >
      <font-awesome-icon :icon="'location-dot'" />
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
import { useSessionPhotos } from '../composables/useSessionPhotos'
import { usePhotoMarkers } from '../composables/usePhotoMarkers'

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
    
    // Session photo management
    const { sessionPhotos } = useSessionPhotos()
    const photoMarkersComposable = ref(null)
    
    // GPS location variables
    const isLocating = ref(false)
    const isTracking = ref(false)
    const watchId = ref(null)
    const userLocationMarker = ref(null)
    const userAccuracyCircle = ref(null)
    
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
        preferCanvas: true,
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: true,
        touchZoom: true,
        bounceAtZoomLimits: true,
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: false,
        tap: true,
        tapTolerance: 15,
        updateWhenIdle: false,
        updateWhenZooming: true,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 60
      })

      // Primary satellite basemap - optimized for offline caching
      const basemapLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 18,
        errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        retryDelay: 2000,
        retryAttempts: 5,
        keepBuffer: 3,
        updateWhenIdle: false,
        updateWhenZooming: true,
        crossOrigin: true
      })
      
      // Backup basemap for better reliability
      const backupBasemap = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 18,
        keepBuffer: 3,
        updateWhenIdle: false,
        updateWhenZooming: true,
        crossOrigin: true,
        retryDelay: 2000,
        retryAttempts: 5
      })
      
      let tileErrorCount = 0
      let switchToBackup = false
      
      basemapLayer.addTo(map)
      
      // Enhanced error handling with automatic fallback and offline detection
      basemapLayer.on('tileerror', (e) => {
        tileErrorCount++
        console.warn('Primary basemap tile error:', e.tile.src, 'Error count:', tileErrorCount)
        
        // Switch to backup after fewer errors for better responsiveness
        if (tileErrorCount > 5 && !switchToBackup) {
          console.log('Switching to backup basemap due to repeated errors')
          switchToBackup = true
          map.removeLayer(basemapLayer)
          backupBasemap.addTo(map)
        }
      })
      
      basemapLayer.on('tileload', (e) => {
        // Reset error count on successful loads
        if (tileErrorCount > 0) {
          tileErrorCount = Math.max(0, tileErrorCount - 2) // Reset faster on success
        }
      })
      
      // Handle backup basemap errors - be more tolerant for offline scenarios
      backupBasemap.on('tileerror', (e) => {
        console.warn('Backup basemap tile error (likely offline):', e.tile.src)
        // Don't switch away from backup - let service worker handle caching
      })
      
      // Monitor for successful tile loads to detect online status
      backupBasemap.on('tileload', (e) => {
        console.log('Backup basemap tile loaded successfully')
      })


      map.on('locationfound', (e) => {
        updateUserLocationMarker(e.latlng, e.accuracy)
      })

      map.on('locationerror', (e) => {
        console.warn('Location access denied or failed:', e.message)
      })

      mapInstance.value = map
      
      // Initialize photo markers after map is ready
      photoMarkersComposable.value = usePhotoMarkers(mapInstance)
    }

    const ensurePopupInViewport = (popupElement) => {
      if (!popupElement) return

      const popup = popupElement.querySelector('.leaflet-popup')
      if (!popup) return

      const rect = popup.getBoundingClientRect()
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      }

      let adjustmentX = 0
      let adjustmentY = 0

      // Check horizontal bounds
      if (rect.left < 20) {
        adjustmentX = 20 - rect.left
      } else if (rect.right > viewport.width - 20) {
        adjustmentX = viewport.width - 20 - rect.right
      }

      // Check vertical bounds
      if (rect.top < 20) {
        adjustmentY = 20 - rect.top
      } else if (rect.bottom > viewport.height - 20) {
        adjustmentY = viewport.height - 20 - rect.bottom
      }

      // Apply adjustments
      if (adjustmentX !== 0 || adjustmentY !== 0) {
        const currentTransform = popup.style.transform || ''
        const translateMatch = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/)
        
        const currentX = translateMatch ? parseFloat(translateMatch[1]) : 0
        const currentY = translateMatch ? parseFloat(translateMatch[2]) : 0
        
        const newX = currentX + adjustmentX
        const newY = currentY + adjustmentY
        
        popup.style.transform = `translate(${newX}px, ${newY}px)`
      }
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
              color: '#1294b9',
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

              const popup = L.popup({
                maxWidth: 280,
                maxHeight: 400,
                className: 'custom-popup',
                autoPan: true,
                autoPanPadding: [20, 20],
                autoClose: false,
                closeOnEscapeKey: false,
                keepInView: true,
                closeButton: true
              }).setContent(`
                <div class="popup-card">
                  <h3>${name}</h3>
                  <div class="popup-content">
                    ${popupContent}
                  </div>
                </div>
              `)

              // Add custom positioning logic to ensure viewport containment
              popup.on('add', (e) => {
                setTimeout(() => {
                  const popupElement = e.target._container
                  if (popupElement) {
                    ensurePopupInViewport(popupElement)
                  }
                }, 10)
              })

              layer.bindPopup(popup)
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




    const updateUserLocationMarker = (latlng, accuracy) => {
      const radius = accuracy / 2
      
      // Remove existing user location markers
      if (userLocationMarker.value) {
        mapInstance.value.removeLayer(userLocationMarker.value)
      }
      if (userAccuracyCircle.value) {
        mapInstance.value.removeLayer(userAccuracyCircle.value)
      }

      // Create new marker
      userLocationMarker.value = L.circleMarker(latlng, {
        className: 'user-location-marker',
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#1294b9',
        fillOpacity: 1
      }).addTo(mapInstance.value)

      // Create accuracy circle
      userAccuracyCircle.value = L.circle(latlng, radius, {
        className: 'user-location-accuracy',
        color: '#1294b9',
        fillColor: '#1294b9',
        fillOpacity: 0.1,
        weight: 2
      }).addTo(mapInstance.value)

      // Update popup with enhanced styling and viewport containment
      const locationPopup = L.popup({
        maxWidth: 280,
        maxHeight: 200,
        className: 'custom-popup location-popup',
        autoPan: true,
        autoPanPadding: [20, 20],
        autoClose: false,
        closeOnEscapeKey: false,
        keepInView: true,
        closeButton: true
      }).setContent(`
        <div class="popup-card">
          <h3>Your Location</h3>
          <div class="popup-content">
            <div class="popup-attribute">
              <span class="key">Accuracy:</span>
              <span class="value">${Math.round(radius)} meters</span>
            </div>
          </div>
        </div>
      `)

      // Add custom positioning logic
      locationPopup.on('add', (e) => {
        setTimeout(() => {
          const popupElement = e.target._container
          if (popupElement) {
            ensurePopupInViewport(popupElement)
          }
        }, 10)
      })

      userLocationMarker.value.bindPopup(locationPopup)

      // Only open popup and center map if not in continuous tracking mode
      if (!isTracking.value) {
        userLocationMarker.value.openPopup()
        mapInstance.value.setView(latlng, Math.max(mapInstance.value.getZoom(), 16))
      } else if (isTracking.value) {
        // In tracking mode, smoothly pan to new location
        mapInstance.value.panTo(latlng, { animate: true, duration: 1 })
      }
    }

    const startLocationTracking = async () => {
      try {
        await checkLocationPermissions()
        
        if (watchId.value) {
          navigator.geolocation.clearWatch(watchId.value)
        }

        const options = {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000 // Accept positions up to 5 seconds old
        }

        // For Safari iOS, use different options
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        
        if (isSafari && isIOS) {
          options.timeout = 15000
          options.maximumAge = 10000
        }

        watchId.value = navigator.geolocation.watchPosition(
          (position) => {
            const latlng = [position.coords.latitude, position.coords.longitude]
            updateUserLocationMarker(latlng, position.coords.accuracy)
          },
          (error) => {
            console.warn('Location tracking error:', error)
            // Keep tracking even on errors, except permission denied
            if (error.code === error.PERMISSION_DENIED) {
              console.error('Location permission denied. Cannot track user location.')
              alert('Location permission denied. Please enable location services to track your position.')
            }
            // For other errors, keep trying - don't stop tracking
          },
          options
        )

        isTracking.value = true
        console.log('Started continuous location tracking - will run indefinitely')
        
      } catch (error) {
        console.error('Failed to start location tracking:', error)
        alert(`GPS Error: ${error.message}`)
      }
    }

    const stopLocationTracking = () => {
      if (watchId.value) {
        navigator.geolocation.clearWatch(watchId.value)
        watchId.value = null
      }
      isTracking.value = false
      console.log('Stopped location tracking')
    }

    const locateUser = async () => {
      try {
        isLocating.value = true
        await checkLocationPermissions()
        
        if (mapInstance.value) {
          mapInstance.value.locate({
            setView: true,
            maxZoom: 16,
            enableHighAccuracy: true
          })
        }
      } catch (error) {
        console.error('Failed to get location:', error)
        alert(`GPS Error: ${error.message}`)
      } finally {
        // Reset locating state after a short delay
        setTimeout(() => {
          isLocating.value = false
        }, 2000)
      }
    }


    const handleGPSClick = () => {
      // Always start continuous tracking - no toggle
      if (!isTracking.value) {
        startLocationTracking()
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

    // Photo marker management functions
    const updatePhotoMarkers = () => {
      if (!photoMarkersComposable.value) return

      // Clear existing markers
      photoMarkersComposable.value.clearAllPhotoMarkers()
      photoMarkersComposable.value.clearPhotoData()

      // Add markers for all session photos with location
      sessionPhotos.value.forEach(photo => {
        if (photo.location) {
          photoMarkersComposable.value.addPhotoMarker(photo)
          photoMarkersComposable.value.setPhotoData(photo.id, photo)
        }
      })
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
      // Don't stop location tracking - keep it running even when component unmounts
      // This allows location tracking to persist across navigation and app state changes
      
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

    // Watch for changes in session photos to update markers
    watch(sessionPhotos, () => {
      updatePhotoMarkers()
    }, { deep: true, immediate: true })

    // Expose methods for external access
    if (props.mapRef) {
      props.mapRef.locateUser = locateUser
      props.mapRef.toggleLayer = toggleLayer
    }

    return {
      mapContainer,
      loading,
      error,
      isLocating,
      isTracking,
      locateUser,
      startLocationTracking,
      stopLocationTracking,
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
  background: #1294b9;
}

.gps-fab {
  position: absolute;
  bottom: 100px;
  right: 16px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1294b9, #26a6c4);
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

.gps-fab.locating {
  background: linear-gradient(135deg, #1294b9, #26a6c4);
  box-shadow: 0 4px 20px rgba(19, 148, 185, 0.6);
  animation: pulse 1.5s infinite;
}

.gps-fab.tracking {
  background: linear-gradient(135deg, #27ae60, #2ecc71);
  box-shadow: 0 4px 20px rgba(46, 204, 113, 0.6);
  animation: tracking-pulse 2s infinite;
}

.gps-fab.disabled {
  pointer-events: none;
  opacity: 0.8;
}

@keyframes pulse {
  0% {
    box-shadow: 0 4px 20px rgba(19, 148, 185, 0.4);
  }
  50% {
    box-shadow: 0 4px 25px rgba(19, 148, 185, 0.8);
  }
  100% {
    box-shadow: 0 4px 20px rgba(19, 148, 185, 0.4);
  }
}

@keyframes tracking-pulse {
  0% {
    box-shadow: 0 4px 20px rgba(46, 204, 113, 0.4);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 4px 25px rgba(46, 204, 113, 0.8);
    transform: scale(1.05);
  }
  100% {
    box-shadow: 0 4px 20px rgba(46, 204, 113, 0.4);
    transform: scale(1);
  }
}

.loading-indicator {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: #1294b9;
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
/* Popup container styling with viewport containment */
.custom-popup .leaflet-popup-content-wrapper {
  border-radius: 12px !important;
  border: none !important;
  background: #fcfcfc !important;
  width: 280px !important;
  max-height: 400px !important;
  box-shadow: 0 8px 32px rgba(19, 148, 185, 0.15) !important;
  overflow: hidden !important;
}

.custom-popup .leaflet-popup-tip {
  background: #fcfcfc !important;
}

/* Ensure popup stays within viewport bounds */
.custom-popup .leaflet-popup {
  margin-bottom: 20px !important;
}

.popup-card {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 12px;
  width: 100%;
  height: 100%;
  max-height: 400px;
  background: #fcfcfc;
  border-radius: 8px;
  color: #1294b9;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.popup-card h3 {
  margin: 0 0 8px 0;
  padding-bottom: 6px;
  border-bottom: 2px solid #1294b9;
  color: #1294b9;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.popup-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 320px;
  padding-right: 4px;
  /* Smooth scrolling for touch devices */
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

/* Custom scrollbar for webkit browsers */
.popup-content::-webkit-scrollbar {
  width: 4px;
}

.popup-content::-webkit-scrollbar-track {
  background: transparent;
}

.popup-content::-webkit-scrollbar-thumb {
  background: rgba(19, 148, 185, 0.3);
  border-radius: 2px;
}

.popup-content::-webkit-scrollbar-thumb:hover {
  background: rgba(19, 148, 185, 0.5);
}

.popup-attribute {
  margin-bottom: 6px;
  padding: 2px 0;
  font-size: 13px;
  line-height: 1.3;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.popup-attribute:last-child {
  margin-bottom: 0;
}

.popup-attribute .key {
  color: #64748b;
  font-weight: 500;
  display: inline-block;
  margin-right: 4px;
}

.popup-attribute .value {
  color: #1294b9;
  font-weight: 400;
}

/* Ensure popup positioning stays within viewport */
@media screen and (max-width: 360px) {
  .custom-popup .leaflet-popup-content-wrapper {
    width: calc(100vw - 40px) !important;
    max-width: 320px !important;
  }
}

@media screen and (max-height: 600px) {
  .custom-popup .leaflet-popup-content-wrapper {
    max-height: 300px !important;
  }
  
  .popup-content {
    max-height: 220px;
  }
}

/* Special styling for location popup */
.location-popup .leaflet-popup-content-wrapper {
  max-height: 200px !important;
}

.location-popup .popup-content {
  max-height: 120px;
}

/* Enhanced close button styling */
.custom-popup .leaflet-popup-close-button {
  color: #64748b !important;
  font-size: 18px !important;
  font-weight: bold !important;
  padding: 4px 8px !important;
  margin: 0 !important;
  background: none !important;
  border: none !important;
}

.custom-popup .leaflet-popup-close-button:hover {
  color: #1294b9 !important;
  background: rgba(19, 148, 185, 0.1) !important;
  border-radius: 4px !important;
}
</style>