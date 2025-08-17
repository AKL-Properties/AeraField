<template>
  <div class="map-container">
    <div 
      ref="mapContainer" 
      class="maplibre-map"
    ></div>
    
    <button
      @click="handleHomeClick"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
      class="home-fab"
    >
      <font-awesome-icon :icon="faHome" />
    </button>

    <button
      @click="handleGPSClick"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
      :class="['gps-fab', { 'locating': isLocating, 'tracking': isTracking, 'disabled': isTracking }]"
    >
      <font-awesome-icon :icon="faLocationDot" />
    </button>


    <div v-if="error" class="error-indicator">
      <div class="error-text">{{ error }}</div>
      <button 
        v-if="!mapInitialized && initializationAttempts < maxInitializationAttempts" 
        @click="retryInitialization" 
        class="retry-button"
      >
        Retry
      </button>
    </div>

    <div v-if="mapInitialized && currentBasemap === 'fallback'" class="fallback-notice">
      Using basic map due to connectivity issues
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, inject } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faHome, faLocationDot } from '@fortawesome/free-solid-svg-icons'
import { useSessionPhotos } from '../composables/useSessionPhotos'
import { usePhotoMarkers } from '../composables/usePhotoMarkers'
import { usePersistedLayers } from '../composables/usePersistedLayers'

export default {
  name: 'MapView',
  components: {
    FontAwesomeIcon
  },
  props: {
    mapRef: Object
  },
  setup(props) {
    const mapContainer = ref(null)
    const mapInstance = ref(null)
    const loading = ref(false)
    const error = ref(null)
    
    // Session photo management
    const { sessionPhotos } = useSessionPhotos()
    const photoMarkersComposable = ref(null)
    
    // Persisted layers management
    const { persistedLayers } = usePersistedLayers()
    
    // GPS location variables
    const isLocating = ref(false)
    const isTracking = ref(false)
    const watchId = ref(null)
    const userLocationMarker = ref(null)
    const userAccuracyCircle = ref(null)
    
    // Basemap management with automatic time-based switching
    const currentBasemap = ref(getTimeBasedBasemap())
    const mapInitialized = ref(false)
    const initializationAttempts = ref(0)
    const maxInitializationAttempts = 3
    const timeBasedSwitchingEnabled = ref(true)
    
    // Function to determine basemap based on device time
    function getTimeBasedBasemap() {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      
      console.log(`Current time: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`)
      
      // 6 AM to 6 PM (06:00 to 17:59) = Liberty style
      // 6 PM to 6 AM (18:00 to 05:59) = Fiord style
      if (hours >= 6 && hours < 18) {
        console.log('Time is between 6 AM and 6 PM - using Liberty basemap')
        return 'liberty'
      } else {
        console.log('Time is between 6 PM and 6 AM - using Fiord basemap')
        return 'fiord'
      }
    }
    
    // Function to update basemap based on current time
    function updateBasemapBasedOnTime() {
      if (!timeBasedSwitchingEnabled.value) return
      
      const newBasemap = getTimeBasedBasemap()
      if (newBasemap !== currentBasemap.value) {
        console.log(`Time-based basemap switch: ${currentBasemap.value} -> ${newBasemap}`)
        currentBasemap.value = newBasemap
        
        // If map is initialized, switch the basemap
        if (mapInstance.value && mapInitialized.value) {
          switchBasemap(newBasemap)
        }
      }
    }
    
    const basemaps = {
      liberty: {
        name: 'Liberty',
        styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
        attribution: '© OpenFreeMap contributors'
      },
      fiord: {
        name: 'Fiord',
        styleUrl: 'https://tiles.openfreemap.org/styles/fiord',
        attribution: '© OpenFreeMap contributors'
      },
      // Fallback option with simple style
      fallback: {
        name: 'Basic',
        styleUrl: {
          "version": 8,
          "sources": {
            "osm": {
              "type": "raster",
              "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              "tileSize": 256,
              "attribution": "© OpenStreetMap contributors"
            }
          },
          "layers": [
            {
              "id": "osm",
              "type": "raster",
              "source": "osm"
            }
          ]
        },
        attribution: '© OpenStreetMap contributors'
      }
    }
    
    
    const mapInstanceProvider = inject('mapInstance', null)

    const retryInitialization = () => {
      setTimeout(() => {
        if (initializationAttempts.value < maxInitializationAttempts) {
          console.log(`Retrying map initialization (attempt ${initializationAttempts.value + 1}/${maxInitializationAttempts})`)
          initializeMap()
        } else {
          console.error('Max initialization attempts reached, switching to fallback basemap')
          currentBasemap.value = 'fallback'
          initializationAttempts.value = 0
          initializeMap()
        }
      }, 2000)
    }

    const initializeMap = () => {
      try {
        initializationAttempts.value++
        
        if (!mapContainer.value) {
          console.error('MapLibre initialization failed: Map container not available')
          if (initializationAttempts.value < maxInitializationAttempts) {
            retryInitialization()
            return
          }
          error.value = 'Map container not found. Please refresh the page.'
          return
        }

        const basemap = basemaps[currentBasemap.value]
        if (!basemap || !basemap.styleUrl) {
          console.error('MapLibre initialization failed: Invalid basemap configuration', { currentBasemap: currentBasemap.value, basemap })
          if (currentBasemap.value !== 'fallback' && initializationAttempts.value < maxInitializationAttempts) {
            console.log('Switching to fallback basemap')
            currentBasemap.value = 'fallback'
            retryInitialization()
            return
          }
          error.value = 'Invalid map configuration. Please try switching basemaps.'
          return
        }

        // Validate center coordinates (centered on Aera properties)
        const centerLng = 121.025
        const centerLat = 14.285
        const initialZoom = 13
        
        if (isNaN(centerLng) || isNaN(centerLat) || isNaN(initialZoom)) {
          console.error('MapLibre initialization failed: Invalid initial map parameters', { centerLng, centerLat, initialZoom })
          error.value = 'Invalid map coordinates. Please refresh the page.'
          return
        }

        if (centerLng < -180 || centerLng > 180 || centerLat < -90 || centerLat > 90) {
          console.error('MapLibre initialization failed: Center coordinates out of valid range', { centerLng, centerLat })
          error.value = 'Invalid map coordinates. Please refresh the page.'
          return
        }

        console.log('Initializing MapLibre GL JS with basemap:', basemap.name)
        
        const map = new maplibregl.Map({
          container: mapContainer.value,
          style: basemap.styleUrl,
          center: [centerLng, centerLat], // [lng, lat] for MapLibre
          zoom: initialZoom,
          attributionControl: false,
          scrollZoom: false,
          doubleClickZoom: true,
          dragPan: true,
          touchZoomRotate: true,
          touchPitch: false,
          failIfMajorPerformanceCaveat: false, // Allow software rendering on older devices
          preserveDrawingBuffer: true // Better for debugging
        })

      // Add attribution control
      map.addControl(new maplibregl.AttributionControl({
        customAttribution: basemap.attribution
      }))

      // Comprehensive error handling for map events
      map.on('error', (e) => {
        console.error('MapLibre GL JS Error:', {
          error: e.error,
          sourceId: e.sourceId,
          tile: e.tile,
          url: e.url,
          message: e.error?.message,
          stack: e.error?.stack,
          basemap: currentBasemap.value,
          attempt: initializationAttempts.value
        })
        
        // Categorize and handle different types of errors
        const errorMessage = e.error?.message || 'Unknown map error'
        
        if (errorMessage.includes('null') || errorMessage.includes('undefined')) {
          console.error('Null/undefined value detected in map data:', errorMessage)
          error.value = 'Data loading error detected. Attempting to recover...'
          
          
        } else if (errorMessage.includes('style') || errorMessage.includes('load')) {
          console.error('Map style loading error:', errorMessage)
          
          if (currentBasemap.value !== 'fallback' && initializationAttempts.value <= maxInitializationAttempts) {
            error.value = 'Map style failed to load. Switching to fallback...'
            currentBasemap.value = 'fallback'
            retryInitialization()
          } else {
            error.value = 'Map style failed to load. Please check your internet connection.'
          }
          
        } else if (errorMessage.includes('source') || errorMessage.includes('layer')) {
          console.error('Map source/layer error:', errorMessage)
          error.value = 'Map layer loading error. Some features may not be visible.'
          
          
        } else {
          error.value = 'Map error detected. Please refresh the page if issues persist.'
        }
      })
      
      map.on('sourcedataloading', (e) => {
        console.log('Map source data loading:', e.sourceId)
      })
      
      map.on('sourcedataabort', (e) => {
        console.warn('Map source data loading aborted:', e.sourceId)
      })
      
      map.on('data', (e) => {
        if (e.dataType === 'source' && e.sourceId) {
          console.log('Map source data loaded:', e.sourceId, e.isSourceLoaded)
        }
      })

      map.on('styledata', (e) => {
        console.log('Map style data event:', {
          isSourceLoaded: e.isSourceLoaded,
          basemap: basemap.name,
          styleLoaded: map.isStyleLoaded(),
          currentStyle: map.getStyle()?.name || 'Unknown'
        })
        
        if (e.isSourceLoaded) {
          console.log(`Map basemap '${basemap.name}' style loaded successfully`)
          
          // Log style sources for debugging
          const style = map.getStyle()
          if (style?.sources) {
            console.log(`Style sources for ${basemap.name}:`, Object.keys(style.sources))
          }
        }
      })
      
      map.on('styleload', () => {
        console.log('Map style fully loaded:', basemap.name)
      })
      
      map.on('style.load', () => {
        console.log('Map style.load event fired for:', basemap.name)
      })

      mapInstance.value = map
      
      // Expose methods and reactive state on the map instance
      map.switchBasemap = switchBasemap
      map.currentBasemap = currentBasemap
      
      // Update the provider with the map instance
      if (mapInstanceProvider) {
        mapInstanceProvider.value = map
      }
      
      console.log('Map instance created with basemap methods exposed')
      
      // Initialize photo markers and persisted layers after map is ready
      map.on('load', () => {
        try {
          console.log('Map load event fired, initializing photo markers and persisted layers')
          mapInitialized.value = true
          initializationAttempts.value = 0 // Reset attempts on successful load
          error.value = null // Clear any previous errors
          
          // Check if we need to switch to time-based basemap after load
          updateBasemapBasedOnTime()
          
          // Initialize photo markers
          photoMarkersComposable.value = usePhotoMarkers(mapInstance)
          
          // Load persisted layers
          loadPersistedLayersToMap()
        } catch (initError) {
          console.error('Failed to initialize map features:', initError)
        }
      })

      
      console.log('MapLibre GL JS initialization completed successfully')
      
    } catch (initError) {
      console.error('MapLibre GL JS initialization failed:', initError)
      
      if (initializationAttempts.value < maxInitializationAttempts && currentBasemap.value !== 'fallback') {
        console.log('Attempting recovery with fallback basemap')
        currentBasemap.value = 'fallback'
        retryInitialization()
      } else {
        error.value = `Map initialization failed: ${initError.message}. Please refresh the page.`
      }
    }
    }








    const getMobileDeviceInfo = () => {
      const userAgent = navigator.userAgent
      return {
        isIOS: /iPad|iPhone|iPod/.test(userAgent),
        isAndroid: /Android/.test(userAgent),
        isSafari: /^((?!chrome|android).)*safari/i.test(userAgent),
        isChrome: /Chrome/.test(userAgent)
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




    const updateUserLocationMarker = (lngLat, accuracy) => {
      // Remove existing user location markers
      if (userLocationMarker.value) {
        userLocationMarker.value.remove()
        userLocationMarker.value = null
      }
      if (userAccuracyCircle.value) {
        if (mapInstance.value.getLayer('user-accuracy')) {
          mapInstance.value.removeLayer('user-accuracy')
        }
        if (mapInstance.value.getSource('user-accuracy')) {
          mapInstance.value.removeSource('user-accuracy')
        }
        userAccuracyCircle.value = null
      }

      // Create accuracy circle source
      const accuracyRadius = accuracy / 2
      const accuracySource = {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: lngLat
          },
          properties: {
            radius: accuracyRadius
          }
        }
      }

      // Add accuracy circle
      if (!mapInstance.value.getSource('user-accuracy')) {
        mapInstance.value.addSource('user-accuracy', accuracySource)
        mapInstance.value.addLayer({
          id: 'user-accuracy',
          type: 'circle',
          source: 'user-accuracy',
          paint: {
            'circle-radius': {
              stops: [
                [0, 0],
                [20, Math.max(accuracyRadius / 10, 5)]
              ],
              base: 2
            },
            'circle-color': '#1294b9',
            'circle-opacity': 0.1,
            'circle-stroke-color': '#1294b9',
            'circle-stroke-width': 2,
            'circle-stroke-opacity': 0.8
          }
        })
      } else {
        mapInstance.value.getSource('user-accuracy').setData(accuracySource.data)
      }

      userAccuracyCircle.value = true

      // Create new marker with direction arrow for tracking mode
      const markerElement = document.createElement('div')
      markerElement.className = 'user-location-marker'
      
      if (isTracking.value) {
        // Tracking mode - red dot with direction arrow and neon red blur
        markerElement.innerHTML = `
          <div class="location-dot tracking-dot"></div>
          <div class="location-arrow">↑</div>
        `
        markerElement.style.cssText = `
          width: 24px;
          height: 24px;
          position: relative;
          cursor: pointer;
        `
      } else {
        // One-time location - simple red dot with neon red blur
        markerElement.style.cssText = `
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background-color: #e74c3c;
          border: 3px solid #ffffff;
          box-shadow: 0 2px 8px rgba(231, 76, 60, 0.4), 0 0 15px rgba(231, 76, 60, 0.6);
          cursor: pointer;
        `
      }

      userLocationMarker.value = new maplibregl.Marker(markerElement)
        .setLngLat(lngLat)
        .addTo(mapInstance.value)

      // Add popup
      const popup = new maplibregl.Popup({
        maxWidth: '280px',
        className: 'custom-popup location-popup'
      }).setHTML(`
        <div class="popup-card">
          <h3>Your Location</h3>
          <div class="popup-content">
            <div class="popup-attribute">
              <span class="key">Accuracy:</span>
              <span class="value">${Math.round(accuracyRadius)} meters</span>
            </div>
          </div>
        </div>
      `)

      userLocationMarker.value.setPopup(popup)

      // Real-time tracking behavior
      if (!isTracking.value) {
        // One-time location - show popup and zoom to location
        popup.addTo(mapInstance.value)
        mapInstance.value.easeTo({
          center: lngLat,
          zoom: Math.max(mapInstance.value.getZoom(), 16),
          duration: 1500
        })
      } else {
        // Continuous tracking mode - smoothly follow user like Google Maps
        const currentZoom = mapInstance.value.getZoom()
        const followZoom = Math.max(currentZoom, 16)
        
        mapInstance.value.easeTo({
          center: lngLat,
          zoom: followZoom,
          duration: 500, // Faster updates for real-time feel
          curve: 1 // Smooth linear movement
        })
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
          timeout: 15000,
          maximumAge: 1000 // Accept positions up to 1 second old for real-time tracking
        }

        // Device-specific options for continuous tracking
        const deviceInfo = getMobileDeviceInfo()
        
        if (deviceInfo.isIOS) {
          options.timeout = 25000 // Longer timeout for iOS
          options.maximumAge = 5000 // More frequent updates
        } else if (deviceInfo.isAndroid) {
          options.timeout = 20000
          options.maximumAge = 3000
        }
        
        console.log('Starting location tracking with options:', options, deviceInfo)

        watchId.value = navigator.geolocation.watchPosition(
          (position) => {
            const lngLat = [position.coords.longitude, position.coords.latitude]
            updateUserLocationMarker(lngLat, position.coords.accuracy)
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
        
        // Get current position for one-time location
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lngLat = [position.coords.longitude, position.coords.latitude]
            updateUserLocationMarker(lngLat, position.coords.accuracy)
          },
          (error) => {
            console.error('Failed to get current location:', error)
            throw error
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
          }
        )
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


    // Track double-tap for stopping GPS tracking
    const lastTapTime = ref(0)
    
    const handleGPSClick = () => {
      console.log('GPS button clicked', { isTracking: isTracking.value, isLocating: isLocating.value })
      
      if (isLocating.value) {
        console.log('GPS is already locating, ignoring click')
        return
      }

      const currentTime = Date.now()
      const timeSinceLastTap = currentTime - lastTapTime.value
      
      if (isTracking.value && timeSinceLastTap < 500) {
        // Double tap to stop tracking
        console.log('Double tap detected, stopping GPS tracking')
        stopLocationTracking()
        alert('GPS tracking stopped. Tap GPS button to start tracking again.')
      } else if (!isTracking.value) {
        // Start continuous tracking
        console.log('Starting GPS tracking')
        startLocationTracking()
      } else {
        // Single tap while tracking - just locate once
        console.log('Single tap while tracking, getting current location')
        locateUser()
      }
      
      lastTapTime.value = currentTime
    }

    const handleHomeClick = () => {
      console.log('Home button clicked')
      
      if (!mapInstance.value) {
        console.warn('Map instance not available')
        alert('Map is not ready yet. Please wait a moment and try again.')
        return
      }
      
      // Navigate to default center coordinates
      const defaultCenter = [121.025, 14.285]
      const defaultZoom = 13
      
      mapInstance.value.easeTo({
        center: defaultCenter,
        zoom: defaultZoom,
        duration: 1500
      })
      
      console.log('Zoomed to default center location')
    }



    const handleTouchStart = (event) => {
      try {
        // Find the button element (could be the icon inside the button)
        let target = event.target
        while (target && !target.classList.contains('gps-fab') && !target.classList.contains('home-fab')) {
          target = target.parentElement
        }
        
        if (target && target.style) {
          target.style.transform = 'scale(0.9)'
          target.style.transition = 'all 0.1s ease'
          
          // Enhanced visual feedback based on button type
          if (target.classList.contains('gps-fab')) {
            if (target.classList.contains('tracking')) {
              target.style.boxShadow = '0 2px 15px rgba(46, 204, 113, 0.8)'
            } else {
              target.style.boxShadow = '0 2px 15px rgba(19, 148, 185, 0.8)'
            }
          } else if (target.classList.contains('home-fab')) {
            target.style.boxShadow = '0 2px 15px rgba(19, 148, 185, 0.8)'
          }
        }
        
        // Add haptic feedback on supported devices
        if (navigator.vibrate) {
          navigator.vibrate(10)
        }
      } catch (touchError) {
        console.warn('Touch start error:', touchError)
      }
    }

    const handleTouchEnd = (event) => {
      try {
        // Find the button element (could be the icon inside the button)
        let target = event.target
        while (target && !target.classList.contains('gps-fab') && !target.classList.contains('home-fab')) {
          target = target.parentElement
        }
        
        if (target && target.style) {
          target.style.transform = 'scale(1)'
          
          // Reset to original shadow based on button type and state
          if (target.classList.contains('gps-fab')) {
            if (target.classList.contains('tracking')) {
              target.style.boxShadow = '0 4px 20px rgba(46, 204, 113, 0.6)'
            } else {
              target.style.boxShadow = '0 4px 20px rgba(19, 148, 185, 0.4)'
            }
          } else if (target.classList.contains('home-fab')) {
            target.style.boxShadow = '0 4px 20px rgba(19, 148, 185, 0.4)'
          }
        }
      } catch (touchError) {
        console.warn('Touch end error:', touchError)
      }
    }

    const handleMouseDown = (event) => {
      try {
        const target = event.target || event.currentTarget
        if (target && target.style) {
          target.style.transform = 'scale(0.9)'
          target.style.transition = 'all 0.1s ease'
        }
      } catch (mouseError) {
        console.warn('Mouse down error:', mouseError)
      }
    }

    const handleMouseUp = (event) => {
      try {
        const target = event.target || event.currentTarget
        if (target && target.style) {
          target.style.transform = 'scale(1)'
        }
      } catch (mouseError) {
        console.warn('Mouse up error:', mouseError)
      }
    }

    const handleMouseLeave = (event) => {
      try {
        const target = event.target || event.currentTarget
        if (target && target.style) {
          target.style.transform = 'scale(1)'
        }
      } catch (mouseError) {
        console.warn('Mouse leave error:', mouseError)
      }
    }

    const switchBasemap = (basemapKey) => {
      console.log('switchBasemap called with:', basemapKey)
      console.log('mapInstance.value:', !!mapInstance.value)
      console.log('basemaps[basemapKey]:', !!basemaps[basemapKey])
      
      if (!mapInstance.value || !basemaps[basemapKey]) {
        console.error('Cannot switch basemap:', { mapInstance: !!mapInstance.value, basemapExists: !!basemaps[basemapKey] })
        return
      }
      
      const basemap = basemaps[basemapKey]
      console.log(`Switching to ${basemap.name} basemap...`)
      console.log('Style URL:', basemap.styleUrl)
      
      // Update current basemap state immediately
      currentBasemap.value = basemapKey
      console.log('Updated currentBasemap to:', currentBasemap.value)
      
      // Set up error handling for style loading
      const styleErrorHandler = (e) => {
        console.error(`Failed to load ${basemap.name} basemap style:`, e)
        error.value = `Failed to load ${basemap.name} basemap. Check your internet connection.`
      }
      
      mapInstance.value.once('error', styleErrorHandler)
      
      // Load new vector style
      try {
        console.log(`About to call setStyle with URL: ${basemap.styleUrl}`)
        mapInstance.value.setStyle(basemap.styleUrl)
        console.log(`Style URL set for ${basemap.name}:`, basemap.styleUrl)
      } catch (styleError) {
        console.error(`Error setting style for ${basemap.name}:`, styleError)
        error.value = `Error switching to ${basemap.name} basemap.`
        return
      }
      
      // Handle style loading events
      mapInstance.value.once('style.load', () => {
        console.log(`${basemap.name} basemap style loaded successfully`)
        
        // Remove error handler since style loaded successfully
        mapInstance.value.off('error', styleErrorHandler)
        
        // Clear any previous errors
        error.value = null
        
        // Log current style information for debugging
        const style = mapInstance.value.getStyle()
        if (style) {
          console.log(`Active style for ${basemap.name}:`, {
            name: style.name,
            sources: Object.keys(style.sources || {}),
            layers: style.layers?.length || 0
          })
        }
        
        // Update photo markers and reload persisted layers after style change
        if (photoMarkersComposable.value) {
          updatePhotoMarkers()
        }
        
        // Reload persisted layers after basemap switch
        loadPersistedLayersToMap()
      })
      
      // Also handle styledata event as fallback
      mapInstance.value.once('styledata', () => {
        if (mapInstance.value.isStyleLoaded()) {
          console.log(`${basemap.name} basemap style data loaded`)
          
          // Update photo markers and reload persisted layers after style change
          if (photoMarkersComposable.value) {
            updatePhotoMarkers()
          }
          
          // Reload persisted layers after basemap switch
          loadPersistedLayersToMap()
        }
      })
      
      console.log(`Basemap switch initiated for ${basemap.name}`)
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

    // Persisted layer management functions
    const addLayerToMap = (layer) => {
      if (!mapInstance.value) return

      const map = mapInstance.value
      const layerId = layer.id

      if (layer.data.type === 'FeatureCollection') {
        map.addSource(layerId, {
          type: 'geojson',
          data: layer.data
        })

        const features = layer.data.features
        const hasPoints = features.some(f => f.geometry.type === 'Point')
        const hasLines = features.some(f => ['LineString', 'MultiLineString'].includes(f.geometry.type))
        const hasPolygons = features.some(f => ['Polygon', 'MultiPolygon'].includes(f.geometry.type))

        if (hasPolygons) {
          map.addLayer({
            id: `${layerId}-fill`,
            type: 'fill',
            source: layerId,
            filter: ['in', '$type', 'Polygon'],
            paint: {
              'fill-color': [
                'case',
                ['has', 'fill', ['get', 'style']],
                ['get', 'fill', ['get', 'style']],
                '#20b2aa'
              ],
              'fill-opacity': [
                'case',
                ['has', 'fill-opacity', ['get', 'style']],
                ['get', 'fill-opacity', ['get', 'style']],
                0.3
              ]
            }
          })

          map.addLayer({
            id: `${layerId}-stroke`,
            type: 'line',
            source: layerId,
            filter: ['in', '$type', 'Polygon'],
            paint: {
              'line-color': [
                'case',
                ['has', 'stroke', ['get', 'style']],
                ['get', 'stroke', ['get', 'style']],
                '#20b2aa'
              ],
              'line-width': [
                'case',
                ['has', 'stroke-width', ['get', 'style']],
                ['get', 'stroke-width', ['get', 'style']],
                2
              ]
            }
          })
        }

        if (hasLines) {
          map.addLayer({
            id: `${layerId}-line`,
            type: 'line',
            source: layerId,
            filter: ['in', '$type', 'LineString'],
            paint: {
              'line-color': [
                'case',
                ['has', 'stroke', ['get', 'style']],
                ['get', 'stroke', ['get', 'style']],
                '#20b2aa'
              ],
              'line-width': [
                'case',
                ['has', 'stroke-width', ['get', 'style']],
                ['get', 'stroke-width', ['get', 'style']],
                2
              ]
            }
          })
        }

        if (hasPoints) {
          map.addLayer({
            id: `${layerId}-point`,
            type: 'circle',
            source: layerId,
            filter: ['in', '$type', 'Point'],
            paint: {
              'circle-color': [
                'case',
                ['has', 'fill', ['get', 'style']],
                ['get', 'fill', ['get', 'style']],
                '#20b2aa'
              ],
              'circle-radius': [
                'case',
                ['has', 'radius', ['get', 'style']],
                ['get', 'radius', ['get', 'style']],
                6
              ],
              'circle-stroke-color': [
                'case',
                ['has', 'stroke', ['get', 'style']],
                ['get', 'stroke', ['get', 'style']],
                '#ffffff'
              ],
              'circle-stroke-width': 2
            }
          })
        }

        // Add click handlers for feature popups
        const layerIds = [`${layerId}-fill`, `${layerId}-stroke`, `${layerId}-line`, `${layerId}-point`]
        
        layerIds.forEach(id => {
          if (map.getLayer(id)) {
            map.on('click', id, (e) => {
              const feature = e.features[0]
              const coordinates = e.lngLat
              
              let popupContent = `<div class="popup-card"><h3>${feature.properties.name || 'Feature'}</h3><div class="popup-content">`
              
              Object.entries(feature.properties).forEach(([key, value]) => {
                if (key !== 'style' && value !== null && value !== undefined && value !== '') {
                  popupContent += `<div class="popup-attribute"><span class="key">${key}:</span> <span class="value">${value}</span></div>`
                }
              })
              
              popupContent += '</div></div>'
              
              new maplibregl.Popup({
                maxWidth: '280px',
                className: 'custom-popup'
              })
                .setLngLat(coordinates)
                .setHTML(popupContent)
                .addTo(map)
            })
            
            map.on('mouseenter', id, () => {
              map.getCanvas().style.cursor = 'pointer'
            })
            
            map.on('mouseleave', id, () => {
              map.getCanvas().style.cursor = ''
            })
          }
        })
      }
    }

    const loadPersistedLayersToMap = () => {
      if (!mapInstance.value) return
      
      persistedLayers.value.forEach(layer => {
        if (layer.visible !== false) {
          addLayerToMap(layer)
        }
      })
      console.log(`Loaded ${persistedLayers.value.length} persisted layers to map`)
    }

    onMounted(() => {
      // Initialize with time-based basemap
      currentBasemap.value = getTimeBasedBasemap()
      console.log(`Initial basemap based on time: ${currentBasemap.value}`)
      
      initializeMap()
      
      // Set up automatic time-based switching every minute
      const timeCheckInterval = setInterval(() => {
        updateBasemapBasedOnTime()
      }, 60000) // Check every minute
      
      // Store interval for cleanup
      window.aeraFieldTimeInterval = timeCheckInterval
      
      // Expose functions for development testing
      if (process.env.NODE_ENV === 'development') {
        window.aeraField = {
          getTimeBasedBasemap,
          updateBasemapBasedOnTime,
          switchBasemap,
          getCurrentBasemap: () => currentBasemap.value,
          setTimeBasedSwitching: (enabled) => { timeBasedSwitchingEnabled.value = enabled }
        }
      }
    })

    onUnmounted(() => {
      // Don't stop location tracking - keep it running even when component unmounts
      // This allows location tracking to persist across navigation and app state changes
      
      // Clean up time-based switching interval
      if (window.aeraFieldTimeInterval) {
        clearInterval(window.aeraFieldTimeInterval)
        window.aeraFieldTimeInterval = null
      }
      
      if (mapInstance.value) {
        mapInstance.value.remove()
        mapInstance.value = null
      }
    })


    // Watch for changes in session photos to update markers
    watch(sessionPhotos, () => {
      updatePhotoMarkers()
    }, { deep: true, immediate: true })

    // Expose methods and state for external access
    if (props.mapRef) {
      props.mapRef.locateUser = locateUser
      props.mapRef.switchBasemap = switchBasemap
      props.mapRef.currentBasemap = currentBasemap
    }


    return {
      mapContainer,
      loading,
      error,
      isLocating,
      isTracking,
      currentBasemap,
      basemaps,
      mapInitialized,
      initializationAttempts,
      maxInitializationAttempts,
      locateUser,
      startLocationTracking,
      stopLocationTracking,
      handleGPSClick,
      handleHomeClick,
      switchBasemap,
      retryInitialization,
      handleTouchStart,
      handleTouchEnd,
      handleMouseDown,
      handleMouseUp,
      handleMouseLeave,
      getTimeBasedBasemap,
      updateBasemapBasedOnTime,
      // FontAwesome icons
      faHome,
      faLocationDot
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

.maplibre-map {
  height: 100%;
  width: 100%;
  background: #1294b9;
}

.home-fab {
  position: absolute;
  bottom: 170px;
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

.home-fab:hover {
  background: linear-gradient(135deg, #1294b9, #26a6c4);
  box-shadow: 0 6px 25px rgba(19, 148, 185, 0.6);
  transform: scale(1.05);
}

.home-fab:active {
  transform: scale(0.95);
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

.gps-fab.tracking::after {
  content: '';
  position: absolute;
  top: -3px;
  right: -3px;
  width: 8px;
  height: 8px;
  background: #e74c3c;
  border-radius: 50%;
  border: 2px solid #ffffff;
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
  padding: 12px 20px;
  border-radius: 20px;
  font-size: 0.9rem;
  z-index: 1000;
  text-align: center;
  min-width: 200px;
}

.loading-text {
  font-weight: 500;
}

.loading-subtext {
  font-size: 0.8rem;
  color: #7cc4d9;
  margin-top: 4px;
}

.error-indicator {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(244, 67, 54, 0.95);
  color: #fcfcfc;
  padding: 12px 20px;
  border-radius: 20px;
  font-size: 0.9rem;
  z-index: 1000;
  text-align: center;
  min-width: 250px;
  max-width: 90vw;
  box-shadow: 0 4px 20px rgba(244, 67, 54, 0.3);
}

.error-text {
  margin-bottom: 8px;
  font-weight: 500;
}

.retry-button {
  background: #fcfcfc;
  color: #f44336;
  border: none;
  padding: 6px 16px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-button:hover {
  background: #f5f5f5;
  transform: scale(1.05);
}

.retry-button:active {
  transform: scale(0.95);
}

.fallback-notice {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 152, 0, 0.9);
  color: #fcfcfc;
  padding: 8px 16px;
  border-radius: 16px;
  font-size: 0.8rem;
  z-index: 1000;
  text-align: center;
}
</style>

<style>
/* Popup container styling with viewport containment */
.custom-popup .maplibregl-popup-content {
  border-radius: 12px !important;
  border: none !important;
  background: #fcfcfc !important;
  width: 280px !important;
  max-height: 400px !important;
  box-shadow: 0 8px 32px rgba(19, 148, 185, 0.15) !important;
  overflow: hidden !important;
  padding: 0 !important;
}

.custom-popup .maplibregl-popup-tip {
  background: #fcfcfc !important;
  border-top-color: #fcfcfc !important;
}

/* Ensure popup stays within viewport bounds */
.custom-popup {
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
  .custom-popup .maplibregl-popup-content {
    width: calc(100vw - 40px) !important;
    max-width: 320px !important;
  }
}

@media screen and (max-height: 600px) {
  .custom-popup .maplibregl-popup-content {
    max-height: 300px !important;
  }
  
  .popup-content {
    max-height: 220px;
  }
}

/* Special styling for location popup */
.location-popup .maplibregl-popup-content {
  max-height: 200px !important;
}

.location-popup .popup-content {
  max-height: 120px;
}

/* Enhanced close button styling */
.custom-popup .maplibregl-popup-close-button {
  color: #64748b !important;
  font-size: 18px !important;
  font-weight: bold !important;
  padding: 4px 8px !important;
  margin: 0 !important;
  background: none !important;
  border: none !important;
}

.custom-popup .maplibregl-popup-close-button:hover {
  color: #1294b9 !important;
  background: rgba(19, 148, 185, 0.1) !important;
  border-radius: 4px !important;
}

/* User location marker with direction arrow for tracking mode */
.user-location-marker .location-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: #e74c3c;
  border: 3px solid #ffffff;
  box-shadow: 0 2px 8px rgba(231, 76, 60, 0.4), 0 0 15px rgba(231, 76, 60, 0.6);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.user-location-marker .location-dot.tracking-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: #e74c3c;
  border: 3px solid #ffffff;
  box-shadow: 0 2px 8px rgba(231, 76, 60, 0.4), 0 0 15px rgba(231, 76, 60, 0.6), 0 0 25px rgba(231, 76, 60, 0.3);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: neon-red-pulse 2s infinite;
}

.user-location-marker .location-arrow {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 8px solid #e74c3c;
  position: absolute;
  top: -2px;
  left: 50%;
  transform: translateX(-50%);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3)) drop-shadow(0 0 5px rgba(231, 76, 60, 0.8));
  font-size: 0; /* Hide the arrow character, use CSS triangle instead */
}

.user-location-marker .location-arrow::before {
  content: '';
  position: absolute;
  top: -1px;
  left: -3px;
  width: 0;
  height: 0;
  border-left: 3px solid transparent;
  border-right: 3px solid transparent;
  border-bottom: 6px solid #ffffff;
}

@keyframes neon-red-pulse {
  0% {
    box-shadow: 0 2px 8px rgba(231, 76, 60, 0.4), 0 0 15px rgba(231, 76, 60, 0.6), 0 0 25px rgba(231, 76, 60, 0.3);
  }
  50% {
    box-shadow: 0 2px 12px rgba(231, 76, 60, 0.6), 0 0 20px rgba(231, 76, 60, 0.8), 0 0 35px rgba(231, 76, 60, 0.5);
  }
  100% {
    box-shadow: 0 2px 8px rgba(231, 76, 60, 0.4), 0 0 15px rgba(231, 76, 60, 0.6), 0 0 25px rgba(231, 76, 60, 0.3);
  }
}
</style>