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
      <font-awesome-icon :icon="'home'" />
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
      <font-awesome-icon :icon="'location-dot'" />
    </button>

    <div v-if="loading" class="loading-indicator">
      <div class="loading-text">Loading layers...</div>
      <div class="loading-subtext" v-if="initializationAttempts > 1">
        Attempt {{ initializationAttempts }}/{{ maxInitializationAttempts }}
      </div>
    </div>

    <div v-if="error" class="error-indicator">
      <div class="error-text">{{ error }}</div>
      <button 
        v-if="!mapInitialized && initializationAttempts < maxInitializationAttempts" 
        @click="retryInitialization" 
        class="retry-button"
      >
        Retry
      </button>
      <button 
        v-if="mapInitialized && error.includes('layer')" 
        @click="() => { layersLoaded = false; loadGeoJSONLayers(); }" 
        class="retry-button"
      >
        Reload Layers
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
import { useGeoJSONLoader } from '../composables/useGeoJSONLoader'
import { useSessionPhotos } from '../composables/useSessionPhotos'
import { usePhotoMarkers } from '../composables/usePhotoMarkers'
import { useLayerStyles } from '../composables/useLayerStyles'

export default {
  name: 'MapView',
  props: {
    mapRef: Object
  },
  setup(props) {
    const mapContainer = ref(null)
    const mapInstance = ref(null)
    const layers = ref(new Map())
    const layersLoaded = ref(false)
    const { geoJsonData, loading, error } = useGeoJSONLoader()
    const { getStyleForLayer, loading: stylesLoading } = useLayerStyles()
    
    // Session photo management
    const { sessionPhotos } = useSessionPhotos()
    const photoMarkersComposable = ref(null)
    
    // GPS location variables
    const isLocating = ref(false)
    const isTracking = ref(false)
    const watchId = ref(null)
    const userLocationMarker = ref(null)
    const userAccuracyCircle = ref(null)
    
    // Basemap management with fallback options
    const currentBasemap = ref('liberty')
    const mapInitialized = ref(false)
    const initializationAttempts = ref(0)
    const maxInitializationAttempts = 3
    
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
    if (mapInstanceProvider) {
      mapInstanceProvider.value = mapInstance
    }

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
          
          // Try to reload GeoJSON data with sanitization
          setTimeout(() => {
            if (geoJsonData.value.length > 0) {
              layersLoaded.value = false
              loadGeoJSONLayers()
            }
          }, 1000)
          
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
          
          // Attempt to recover by reloading layers
          setTimeout(() => {
            layersLoaded.value = false
            loadGeoJSONLayers()
          }, 2000)
          
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
          styleLoaded: map.isStyleLoaded()
        })
        
        if (e.isSourceLoaded) {
          console.log(`Map basemap '${basemap.name}' style loaded successfully`)
        }
      })
      
      map.on('styleload', () => {
        console.log('Map style fully loaded:', basemap.name)
      })
      
      map.on('style.load', () => {
        console.log('Map style.load event fired for:', basemap.name)
      })

      mapInstance.value = map
      
      // Expose methods on the map instance
      map.applyLayerStyle = applyLayerStyle
      map.toggleLayer = toggleLayer
      
      // Initialize photo markers after map is ready
      map.on('load', () => {
        try {
          console.log('Map load event fired, initializing photo markers')
          mapInitialized.value = true
          initializationAttempts.value = 0 // Reset attempts on successful load
          error.value = null // Clear any previous errors
          
          photoMarkersComposable.value = usePhotoMarkers(mapInstance)
        } catch (photoError) {
          console.error('Failed to initialize photo markers:', photoError)
        }
      })

      // Load GeoJSON layers when style is ready (only once)
      map.once('styledata', () => {
        try {
          console.log('Style data ready, checking layer loading conditions:', {
            styleLoaded: map.isStyleLoaded(),
            geoJsonDataLength: geoJsonData.value.length,
            layersLoaded: layersLoaded.value
          })
          
          if (map.isStyleLoaded() && geoJsonData.value.length > 0) {
            loadGeoJSONLayers()
          }
        } catch (layerError) {
          console.error('Failed to load GeoJSON layers on style ready:', layerError)
          error.value = 'Failed to load map layers. Please refresh the page.'
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


    const validateGeoJSONData = (data, layerName) => {
      if (!data) {
        throw new Error(`GeoJSON data is null or undefined for layer: ${layerName}`)
      }
      
      if (typeof data !== 'object') {
        throw new Error(`GeoJSON data is not an object for layer: ${layerName}`)
      }
      
      if (!data.type || data.type !== 'FeatureCollection') {
        throw new Error(`Invalid GeoJSON type for layer: ${layerName}. Expected 'FeatureCollection', got: ${data.type}`)
      }
      
      if (!Array.isArray(data.features)) {
        throw new Error(`GeoJSON features is not an array for layer: ${layerName}`)
      }
      
      // Validate each feature
      data.features.forEach((feature, index) => {
        if (!feature) {
          throw new Error(`Feature ${index} is null/undefined in layer: ${layerName}`)
        }
        
        if (!feature.type || feature.type !== 'Feature') {
          throw new Error(`Invalid feature type at index ${index} in layer: ${layerName}`)
        }
        
        if (!feature.geometry) {
          throw new Error(`Feature ${index} missing geometry in layer: ${layerName}`)
        }
        
        if (!feature.geometry.type) {
          throw new Error(`Feature ${index} missing geometry type in layer: ${layerName}`)
        }
        
        if (!Array.isArray(feature.geometry.coordinates)) {
          throw new Error(`Feature ${index} has invalid coordinates in layer: ${layerName}`)
        }
        
        // Validate coordinate values
        const validateCoordinates = (coords, depth = 0) => {
          if (depth > 4) return // Prevent infinite recursion
          
          if (Array.isArray(coords)) {
            coords.forEach((coord, i) => {
              if (Array.isArray(coord)) {
                validateCoordinates(coord, depth + 1)
              } else if (typeof coord === 'number') {
                if (!isFinite(coord)) {
                  throw new Error(`Invalid coordinate value (${coord}) at feature ${index} in layer: ${layerName}`)
                }
              }
            })
          }
        }
        
        try {
          validateCoordinates(feature.geometry.coordinates)
        } catch (coordError) {
          console.error(`Coordinate validation failed for feature ${index} in layer ${layerName}:`, coordError)
          throw coordError
        }
      })
      
      return true
    }

    const loadAeraLayerWithAdvancedStyling = async () => {
      try {
        console.log('🎨 Loading Aera layer with advanced categorical styling...')
        
        // Load Styles.json for Aera layer
        const stylesResponse = await fetch('/data/Styles.json')
        const stylesData = await stylesResponse.json()
        
        // Find the Aera style configuration
        const aeraStyleConfig = stylesData.find(style => style.layer_id === 'Aera')
        if (!aeraStyleConfig) {
          console.warn('No Aera style configuration found in Styles.json, using default styling')
          return false
        }
        
        console.log('🎨 Aera style configuration loaded:', aeraStyleConfig)
        
        // Parse the advanced style configuration
        const styleConfig = JSON.parse(aeraStyleConfig.style)
        console.log('🎨 Parsed style configuration:', styleConfig)
        
        return styleConfig
      } catch (error) {
        console.error('Failed to load Aera advanced styling:', error)
        return false
      }
    }

    const loadGeoJSONLayers = async () => {
      console.group('🚀 loadGeoJSONLayers: Starting layer loading process')
      
      try {
        console.log('🔍 Pre-flight checks:', {
          hasMapInstance: !!mapInstance.value,
          dataLength: geoJsonData.value.length,
          layersLoaded: layersLoaded.value,
          mapStyleLoaded: mapInstance.value?.isStyleLoaded() || false,
          mapInitialized: mapInitialized.value
        })
        
        if (!mapInstance.value || !geoJsonData.value.length || layersLoaded.value) {
          const skipReason = !mapInstance.value ? 'No map instance' : 
                            !geoJsonData.value.length ? 'No GeoJSON data' :
                            'Layers already loaded'
          console.log(`❌ Skipping layer loading: ${skipReason}`)
          console.groupEnd()
          return
        }
        
        // Check if the style is loaded before adding sources
        if (!mapInstance.value.isStyleLoaded()) {
          console.log('⏳ Map style not loaded yet, waiting...')
          console.groupEnd()
          return
        }

        console.log(`✅ All checks passed. Loading ${geoJsonData.value.length} GeoJSON layers...`)
        console.log('📄 Layer data:', geoJsonData.value.map(layer => ({
          name: layer.name,
          filename: layer.filename,
          featuresCount: layer.data?.features?.length || 0,
          type: layer.type
        })))
        
        for (const { name, data } of geoJsonData.value) {
          try {
            const layerId = name
            
            console.log(`Processing layer: ${name}`, {
              layerId,
              hasData: !!data,
              dataType: typeof data
            })
            
            // Validate GeoJSON data structure
            validateGeoJSONData(data, name)
            
            // Skip if layer already exists
            if (layers.value.has(name) && mapInstance.value.getSource(layerId)) {
              console.log(`Layer ${name} already loaded, skipping...`)
              continue
            }

            layers.value.set(name, layerId)

            // Add source if it doesn't exist
            if (!mapInstance.value.getSource(layerId)) {
              console.log(`Adding source for layer: ${name}`)
              mapInstance.value.addSource(layerId, {
                type: 'geojson',
                data: data,
                tolerance: 0.375,
                maxzoom: 18,
                buffer: 64
              })
              console.log(`Source added successfully for layer: ${name}`)
            } else {
              console.log(`Source already exists for layer: ${name}`)
            }

            // Check if this is the Aera layer and apply advanced styling
            if (name === 'Aera' || layerId === 'Aera') {
              console.log('🎨 Applying advanced Aera styling...')
              const aeraStyleConfig = await loadAeraLayerWithAdvancedStyling()
              
              if (aeraStyleConfig && aeraStyleConfig.categorical) {
                // Apply categorical styling based on ACQUISITION GROUP
                const categoricalField = aeraStyleConfig.categorical.field
                const categories = aeraStyleConfig.categorical.categories
                
                console.log(`🎨 Applying categorical styling for field: ${categoricalField}`)
                console.log(`🎨 Categories:`, categories)
                
                // Create MapLibre categorical expression for fill color
                const fillColorExpression = ['case']
                const fillOutlineExpression = ['case']
                
                categories.forEach(category => {
                  fillColorExpression.push(['==', ['get', categoricalField], category.value])
                  fillColorExpression.push(category.color)
                  
                  fillOutlineExpression.push(['==', ['get', categoricalField], category.value])
                  fillOutlineExpression.push(category.strokeColor || '#ffffff')
                })
                
                // Add default colors
                fillColorExpression.push(aeraStyleConfig.categorical.defaultColor || '#cccccc')
                fillOutlineExpression.push('#ffffff')
                
                // Get the topmost basemap layer ID to ensure GeoJSON layers appear above basemap
                const topBasemapLayerId = getTopBasemapLayerId()
                
                // Add fill layer with categorical styling above basemap
                if (!mapInstance.value.getLayer(layerId + '-fill')) {
                  mapInstance.value.addLayer({
                    id: layerId + '-fill',
                    type: 'fill',
                    source: layerId,
                    filter: ['in', '$type', 'Polygon'],
                    paint: {
                      'fill-color': fillColorExpression,
                      'fill-opacity': aeraStyleConfig.fill_opacity || 0.8,
                      'fill-outline-color': fillOutlineExpression
                    }
                  }, topBasemapLayerId)
                  console.log(`✅ Aera fill layer added with categorical styling above basemap`)
                }
                
                // Add stroke layer above fill layer
                if (!mapInstance.value.getLayer(layerId + '-stroke')) {
                  mapInstance.value.addLayer({
                    id: layerId + '-stroke',
                    type: 'line',
                    source: layerId,
                    paint: {
                      'line-color': fillOutlineExpression,
                      'line-width': aeraStyleConfig.stroke_weight || 2,
                      'line-opacity': aeraStyleConfig.stroke_opacity || 1
                    }
                  }, topBasemapLayerId)
                  console.log(`✅ Aera stroke layer added with categorical styling above fill layer`)
                }
              } else {
                console.log('🎨 No categorical styling found, applying default Aera styling')
                // Fallback to standard styling
                await applyStandardStyling(layerId, name)
              }
            } else {
              // Apply standard styling for other layers
              await applyStandardStyling(layerId, name)
            }

            // Add event handlers only once per layer
            if (!mapInstance.value._layerHandlersAdded) {
              mapInstance.value._layerHandlersAdded = new Set()
            }

            if (!mapInstance.value._layerHandlersAdded.has(layerId)) {
              // Add click handlers for popups
              const layersToAddHandlers = [layerId + '-fill', layerId + '-stroke', layerId + '-point']
              
              layersToAddHandlers.forEach(layerName => {
                if (mapInstance.value.getLayer(layerName)) {
                  mapInstance.value.on('click', layerName, (e) => {
                    createPopup(e, name)
                  })
                  mapInstance.value.on('mouseenter', layerName, () => {
                    mapInstance.value.getCanvas().style.cursor = 'pointer'
                  })
                  mapInstance.value.on('mouseleave', layerName, () => {
                    mapInstance.value.getCanvas().style.cursor = ''
                  })
                }
              })

              mapInstance.value._layerHandlersAdded.add(layerId)
            }

            console.log(`Layer ${name} loaded successfully with styling`)
            
          } catch (layerError) {
            console.error(`Error loading layer ${name}:`, layerError)
            error.value = `Failed to load layer '${name}': ${layerError.message}`
          }
        }
        
      } catch (loadError) {
        console.error('💥 Error in loadGeoJSONLayers:', {
          error: loadError.message,
          stack: loadError.stack?.split('\n').slice(0, 5)
        })
        error.value = `Failed to load map layers: ${loadError.message}`
        console.groupEnd()
        return
      }

      // Mark layers as loaded to prevent duplicate loading
      layersLoaded.value = true
      console.log('✅ All GeoJSON layers processed successfully')
      
      console.groupEnd() // Close the main loadGeoJSONLayers group
    }

    const applyStandardStyling = async (layerId, name) => {
      // Get custom styles for this layer
      const layerStyle = getStyleForLayer(name)
      
      console.log(`Layer ${name} style configuration:`, layerStyle)

      // Standard styling for all layers
      // Validate style properties
      const requiredStyleProps = ['fill_color', 'fill_opacity', 'stroke_color', 'stroke_width', 'stroke_opacity', 'point_color', 'point_radius']
      requiredStyleProps.forEach(prop => {
        if (layerStyle[prop] === null || layerStyle[prop] === undefined) {
          console.warn(`Style property ${prop} is null/undefined for layer ${name}, using default`)
        }
      })
      
      // Get the topmost basemap layer ID to ensure GeoJSON layers appear above basemap
      const topBasemapLayerId = getTopBasemapLayerId()
      
      // Add fill layer for polygons (including MultiPolygons)
      if (!mapInstance.value.getLayer(layerId + '-fill')) {
        console.log(`Adding fill layer for: ${name} above basemap`)
        
        const fillPaint = {
          'fill-color': layerStyle.fill_color || 'rgba(18, 148, 185, 0.1)',
          'fill-opacity': layerStyle.fill_opacity ?? 0.2
        }
        
        // Validate paint properties
        Object.entries(fillPaint).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            console.error(`Fill paint property ${key} is null/undefined for layer ${name}`)
            throw new Error(`Invalid fill paint property: ${key}`)
          }
        })
        
        mapInstance.value.addLayer({
          id: layerId + '-fill',
          type: 'fill',
          source: layerId,
          filter: ['in', '$type', 'Polygon'],
          paint: fillPaint
        }, topBasemapLayerId)
        console.log(`Fill layer added successfully for: ${name} above basemap`)
      }

      // Add stroke layer for all geometries above fill layer
      if (!mapInstance.value.getLayer(layerId + '-stroke')) {
        console.log(`Adding stroke layer for: ${name} above fill layer`)
        
        const strokePaint = {
          'line-color': layerStyle.stroke_color || '#1294b9',
          'line-width': layerStyle.stroke_width ?? 3,
          'line-opacity': layerStyle.stroke_opacity ?? 1
        }
        
        // Validate paint properties
        Object.entries(strokePaint).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            console.error(`Stroke paint property ${key} is null/undefined for layer ${name}`)
            throw new Error(`Invalid stroke paint property: ${key}`)
          }
        })
        
        mapInstance.value.addLayer({
          id: layerId + '-stroke',
          type: 'line',
          source: layerId,
          paint: strokePaint
        }, topBasemapLayerId)
        console.log(`Stroke layer added successfully for: ${name} above fill layer`)
      }

      // Add point layer for point geometries above stroke layer
      if (!mapInstance.value.getLayer(layerId + '-point')) {
        console.log(`Adding point layer for: ${name} above stroke layer`)
        
        const pointPaint = {
          'circle-color': layerStyle.point_color || '#1294b9',
          'circle-radius': layerStyle.point_radius ?? 6,
          'circle-stroke-color': layerStyle.point_stroke_color || '#ffffff',
          'circle-stroke-width': layerStyle.point_stroke_width ?? 2
        }
        
        // Validate paint properties
        Object.entries(pointPaint).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            console.error(`Point paint property ${key} is null/undefined for layer ${name}`)
            throw new Error(`Invalid point paint property: ${key}`)
          }
        })
        
        mapInstance.value.addLayer({
          id: layerId + '-point',
          type: 'circle',
          source: layerId,
          filter: ['==', '$type', 'Point'],
          paint: pointPaint
        }, topBasemapLayerId)
        console.log(`Point layer added successfully for: ${name} above stroke layer`)
      }
    }

    const getTopBasemapLayerId = () => {
      try {
        if (!mapInstance.value) return undefined
        
        // Get all layers in the style
        const style = mapInstance.value.getStyle()
        if (!style || !style.layers) return undefined
        
        // Find all basemap layers (typically have specific patterns in their IDs)
        // Common basemap layer patterns: background, land, water, roads, labels, etc.
        const basemapPatterns = [
          /^background/,
          /^land/,
          /^water/,
          /^ocean/,
          /^landcover/,
          /^landuse/,
          /^park/,
          /^building/,
          /^road/,
          /^highway/,
          /^tunnel/,
          /^bridge/,
          /^railway/,
          /^admin/,
          /^country/,
          /^state/,
          /^place/,
          /^poi/,
          /^transit/,
          /label/,
          /text/
        ]
        
        // Find the topmost basemap layer
        let topBasemapLayerId = undefined
        
        // Iterate through layers from top to bottom to find the last basemap layer
        for (let i = style.layers.length - 1; i >= 0; i--) {
          const layer = style.layers[i]
          if (layer && layer.id) {
            const isBasemapLayer = basemapPatterns.some(pattern => pattern.test(layer.id))
            if (isBasemapLayer) {
              // This is the topmost basemap layer
              topBasemapLayerId = layer.id
              break
            }
          }
        }
        
        console.log('🎯 Top basemap layer identified:', topBasemapLayerId)
        return topBasemapLayerId
        
      } catch (error) {
        console.warn('Failed to identify top basemap layer:', error)
        return undefined
      }
    }

    const createPopup = (e, layerName) => {
      const popupContent = Object.entries(e.features[0].properties)
        .map(([key, value]) => `
          <div class="popup-attribute">
            <span class="key">${key}:</span> 
            <span class="value">${value || 'N/A'}</span>
          </div>
        `).join('')

      const popup = new maplibregl.Popup({
        maxWidth: '280px',
        className: 'custom-popup'
      })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="popup-card">
            <h3>${layerName}</h3>
            <div class="popup-content">
              ${popupContent}
            </div>
          </div>
        `)
        .addTo(mapInstance.value)
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

      // Add accuracy circle above basemap layers
      if (!mapInstance.value.getSource('user-accuracy')) {
        mapInstance.value.addSource('user-accuracy', accuracySource)
        const topBasemapLayerId = getTopBasemapLayerId()
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
        }, topBasemapLayerId)
      } else {
        mapInstance.value.getSource('user-accuracy').setData(accuracySource.data)
      }

      userAccuracyCircle.value = true

      // Create new marker with direction arrow for tracking mode
      const markerElement = document.createElement('div')
      markerElement.className = 'user-location-marker'
      
      if (isTracking.value) {
        // Tracking mode - blue dot with direction arrow
        markerElement.innerHTML = `
          <div class="location-dot"></div>
          <div class="location-arrow">↑</div>
        `
        markerElement.style.cssText = `
          width: 24px;
          height: 24px;
          position: relative;
          cursor: pointer;
        `
      } else {
        // One-time location - simple blue dot
        markerElement.style.cssText = `
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background-color: #1294b9;
          border: 3px solid #ffffff;
          box-shadow: 0 2px 8px rgba(19, 148, 185, 0.4);
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
      const currentTime = Date.now()
      const timeSinceLastTap = currentTime - lastTapTime.value
      
      if (isTracking.value && timeSinceLastTap < 500) {
        // Double tap to stop tracking
        stopLocationTracking()
        alert('GPS tracking stopped. Tap GPS button to start tracking again.')
      } else if (!isTracking.value) {
        // Start continuous tracking
        startLocationTracking()
      }
      
      lastTapTime.value = currentTime
    }

    const handleHomeClick = () => {
      if (!mapInstance.value) return
      
      // Find the Aera layer in the loaded layers
      const aeraLayerId = layers.value.get('Aera')
      if (!aeraLayerId) {
        console.warn('Aera layer not found')
        return
      }
      
      // Get the source data for the Aera layer
      const aeraSource = mapInstance.value.getSource(aeraLayerId)
      if (!aeraSource) {
        console.warn('Aera source not found')
        return
      }
      
      // Get the GeoJSON data from the source
      const aeraData = aeraSource._data
      if (!aeraData || !aeraData.features || aeraData.features.length === 0) {
        console.warn('Aera layer has no features to zoom to')
        return
      }
      
      // Calculate bounds of all features in the Aera layer
      const bounds = new maplibregl.LngLatBounds()
      
      aeraData.features.forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
          const addCoordinatesToBounds = (coords) => {
            if (feature.geometry.type === 'Point') {
              bounds.extend(coords)
            } else if (feature.geometry.type === 'LineString') {
              coords.forEach(coord => bounds.extend(coord))
            } else if (feature.geometry.type === 'Polygon') {
              coords.forEach(ring => {
                ring.forEach(coord => bounds.extend(coord))
              })
            } else if (feature.geometry.type === 'MultiPolygon') {
              coords.forEach(polygon => {
                polygon.forEach(ring => {
                  ring.forEach(coord => bounds.extend(coord))
                })
              })
            }
          }
          
          addCoordinatesToBounds(feature.geometry.coordinates)
        }
      })
      
      // Zoom to the calculated bounds with padding
      mapInstance.value.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        duration: 1500
      })
      
      console.log('Zoomed to Aera layer extent')
    }


    const toggleLayer = (layerName, visible) => {
      const layerId = layers.value.get(layerName)
      if (layerId && mapInstance.value) {
        const fillLayerId = layerId + '-fill'
        const strokeLayerId = layerId + '-stroke'
        const pointLayerId = layerId + '-point'
        
        const visibility = visible ? 'visible' : 'none'
        
        if (mapInstance.value.getLayer(fillLayerId)) {
          mapInstance.value.setLayoutProperty(fillLayerId, 'visibility', visibility)
        }
        if (mapInstance.value.getLayer(strokeLayerId)) {
          mapInstance.value.setLayoutProperty(strokeLayerId, 'visibility', visibility)
        }
        if (mapInstance.value.getLayer(pointLayerId)) {
          mapInstance.value.setLayoutProperty(pointLayerId, 'visibility', visibility)
        }
      }
    }

    const handleTouchStart = (event) => {
      try {
        // Prevent default to avoid conflicts with map touch events
        event.preventDefault()
        
        const target = event.target || event.currentTarget
        if (target && target.style) {
          target.style.transform = 'scale(0.9)'
          target.style.boxShadow = '0 2px 15px rgba(19, 148, 185, 0.6)'
          target.style.transition = 'all 0.1s ease'
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
        const target = event.target || event.currentTarget
        if (target && target.style) {
          target.style.transform = 'scale(1)'
          target.style.boxShadow = '0 4px 20px rgba(19, 148, 185, 0.4)'
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
      if (!mapInstance.value || !basemaps[basemapKey]) return
      
      const basemap = basemaps[basemapKey]
      currentBasemap.value = basemapKey
      
      // Reset layers loaded flag to allow re-loading after style change
      layersLoaded.value = false
      layers.value.clear()
      
      // Load new vector style
      mapInstance.value.setStyle(basemap.styleUrl)
      
      // Re-add GeoJSON layers after style change (only once)
      mapInstance.value.once('styledata', () => {
        if (mapInstance.value.isStyleLoaded()) {
          loadGeoJSONLayers()
          updatePhotoMarkers()
        }
      })
      
      console.log(`Switched to ${basemap.name} basemap`)
    }

    // Layer styling functions
    const applyLayerStyle = (layerName, style, styleConfig) => {
      if (!mapInstance.value) {
        console.warn('Cannot apply layer style: Map instance not available')
        return
      }

      const layerId = layers.value.get(layerName)
      if (!layerId) {
        console.warn(`Cannot apply style: Layer '${layerName}' not found`)
        return
      }

      try {
        console.log(`Applying style to layer: ${layerName}`, style)

        // Update fill layer if exists
        const fillLayerId = layerId + '-fill'
        if (mapInstance.value.getLayer(fillLayerId)) {
          // Apply fill paint properties
          if (style['fill-color']) {
            mapInstance.value.setPaintProperty(fillLayerId, 'fill-color', style['fill-color'])
          }
          if (style['fill-opacity'] !== undefined) {
            mapInstance.value.setPaintProperty(fillLayerId, 'fill-opacity', style['fill-opacity'])
          }
          if (style['fill-outline-color']) {
            mapInstance.value.setPaintProperty(fillLayerId, 'fill-outline-color', style['fill-outline-color'])
          }
        }

        // Update stroke layer if exists
        const strokeLayerId = layerId + '-stroke'
        if (mapInstance.value.getLayer(strokeLayerId)) {
          if (style['fill-outline-color']) {
            mapInstance.value.setPaintProperty(strokeLayerId, 'line-color', style['fill-outline-color'])
          }
          if (style['fill-outline-width'] !== undefined) {
            mapInstance.value.setPaintProperty(strokeLayerId, 'line-width', style['fill-outline-width'])
          }
          if (style['fill-outline-opacity'] !== undefined) {
            mapInstance.value.setPaintProperty(strokeLayerId, 'line-opacity', style['fill-outline-opacity'])
          }
        }

        // Store the style configuration for persistence
        if (!mapInstance.value._customLayerStyles) {
          mapInstance.value._customLayerStyles = new Map()
        }
        mapInstance.value._customLayerStyles.set(layerName, { style, styleConfig })

        console.log(`Successfully applied style to layer: ${layerName}`)
      } catch (error) {
        console.error(`Failed to apply style to layer ${layerName}:`, error)
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
    })

    onUnmounted(() => {
      // Don't stop location tracking - keep it running even when component unmounts
      // This allows location tracking to persist across navigation and app state changes
      
      if (mapInstance.value) {
        mapInstance.value.remove()
        mapInstance.value = null
      }
    })

    watch(geoJsonData, (newData, oldData) => {
      console.group('👁️ GeoJSON Data Watcher Triggered')
      console.log('🔍 Watch trigger details:', {
        newDataLength: newData.length,
        oldDataLength: oldData?.length || 0,
        layersLoaded: layersLoaded.value,
        mapInitialized: mapInitialized.value,
        hasMapInstance: !!mapInstance.value,
        styleLoaded: mapInstance.value?.isStyleLoaded() || false
      })
      
      // Only load layers if we have data and haven't loaded them yet
      if (newData.length > 0 && !layersLoaded.value && mapInstance.value && mapInitialized.value) {
        console.log('✅ Conditions met for layer loading')
        
        try {
          if (mapInstance.value.isStyleLoaded()) {
            console.log('🎯 Map style is loaded, calling loadGeoJSONLayers immediately')
            loadGeoJSONLayers()
          } else {
            console.log('⏳ Map style not loaded yet, waiting for styledata event')
            // If map exists but style isn't loaded yet, wait for it
            mapInstance.value.once('styledata', () => {
              try {
                console.log('🎯 Map style loaded via event, calling loadGeoJSONLayers')
                if (mapInstance.value.isStyleLoaded()) {
                  loadGeoJSONLayers()
                }
              } catch (watchError) {
                console.error('❌ Error loading layers in style watch:', watchError)
              }
            })
          }
        } catch (watchError) {
          console.error('❌ Error in geoJsonData watcher:', watchError)
        }
      } else {
        console.log('❌ Conditions not met for layer loading:', {
          hasData: newData.length > 0,
          layersNotLoaded: !layersLoaded.value,
          hasMap: !!mapInstance.value,
          mapInitialized: mapInitialized.value
        })
      }
      
      console.groupEnd()
    }, { deep: true })

    // Watch for changes in session photos to update markers
    watch(sessionPhotos, () => {
      updatePhotoMarkers()
    }, { deep: true, immediate: true })

    // Expose methods for external access
    if (props.mapRef) {
      props.mapRef.locateUser = locateUser
      props.mapRef.toggleLayer = toggleLayer
      props.mapRef.switchBasemap = switchBasemap
      props.mapRef.applyLayerStyle = applyLayerStyle
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
      layersLoaded,
      loadGeoJSONLayers,
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
      handleMouseLeave
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
  background:#12949b;
  border: none;
  color: #fcfcfc;
  font-size: 1.5rem;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(44, 62, 80, 0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.home-fab:hover {
  background: linear-gradient(135deg, #34495e, #2c3e50);
  box-shadow: 0 6px 25px rgba(44, 62, 80, 0.6);
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
  background-color: #1294b9;
  border: 3px solid #ffffff;
  box-shadow: 0 2px 8px rgba(19, 148, 185, 0.4);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.user-location-marker .location-arrow {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 8px solid #1294b9;
  position: absolute;
  top: -2px;
  left: 50%;
  transform: translateX(-50%);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
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
</style>