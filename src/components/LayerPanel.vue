<template>
  <div class="layer-panel">
    <div class="panel-header">
      <h2>Map Layers</h2>
    </div>
    
    <div class="panel-content">
      <div class="add-layer-section">
        <button 
          @click="openFilePicker"
          class="add-layer-button"
        >
          <font-awesome-icon :icon="faPlus" />
          Add GeoJSON/KML/KMZ Layer
        </button>
        <input 
          ref="fileInput"
          type="file"
          accept=".geojson,.json,.kml,.kmz"
          @change="handleFileSelect"
          style="display: none"
        />
      </div>

      <div class="layers-list" v-if="layers.length > 0">
        <h3>Loaded Layers</h3>
        <div 
          v-for="layer in layers" 
          :key="layer.id"
          class="layer-item"
        >
          <div class="layer-info">
            <span class="layer-name">{{ layer.name }}</span>
            <div class="layer-meta">
              <span class="layer-type">{{ layer.type }}</span>
              <span v-if="layer.isPermanent" class="layer-permanent">🔒 Permanent</span>
              <span v-else class="layer-stored">📱 Stored</span>
            </div>
          </div>
          <div class="layer-controls">
            <button 
              @click="openPropertiesModal(layer)"
              class="properties-button"
              title="Layer Properties"
            >
              <font-awesome-icon :icon="faCog" />
            </button>
            <button 
              @click="toggleLayerVisibility(layer.id)"
              :class="['visibility-button', { visible: layer.visible }]"
            >
              <font-awesome-icon :icon="layer.visible ? faEye : faEyeSlash" />
            </button>
            <button 
              v-if="!layer.isPermanent"
              @click="removeLayer(layer.id)"
              class="remove-button"
            >
              <font-awesome-icon :icon="faTrash" />
            </button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <font-awesome-icon :icon="faLayerGroup" class="empty-icon" />
        <p>No layers added yet</p>
        <p class="empty-subtitle">Use the button above to add GeoJSON, KML, or KMZ layers</p>
      </div>

      <!-- Storage Information -->
      <div v-if="persistedLayers.length > 0" class="storage-info">
        <div class="storage-stats">
          <span class="storage-label">Stored Layers:</span>
          <span class="storage-value">{{ persistedLayers.length }}</span>
        </div>
        <div class="storage-stats">
          <span class="storage-label">Storage Used:</span>
          <span class="storage-value">{{ getStorageInfo().formatted }}</span>
        </div>
      </div>
    </div>

    <div v-if="loading || supabaseLoading" class="loading-overlay">
      <div class="spinner"></div>
      <span v-if="supabaseLoading">Loading permanent layers...</span>
      <span v-else>Processing layer...</span>
    </div>

    <div v-if="error || supabaseErrorMessage" class="error-message">
      <font-awesome-icon :icon="faExclamationTriangle" />
      <span>{{ error || supabaseErrorMessage }}</span>
      <button @click="clearError" class="close-error">×</button>
    </div>

    <!-- Symbology Editor Modal -->
    <SymbologyEditor
      :visible="showSymbologyEditor"
      :layer-name="selectedLayer?.name || ''"
      :layer-data="selectedLayer?.data"
      :layer-id="selectedLayer?.id || ''"
      :existing-symbology="selectedLayer?.symbology"
      @close="closeSymbologyEditor"
      @apply="applySymbology"
      @colorChange="onColorChange"
    />
  </div>
</template>

<script>
import { ref, inject, onMounted, computed } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { 
  faPlus, 
  faEye, 
  faEyeSlash, 
  faTrash, 
  faLayerGroup,
  faExclamationTriangle,
  faDownload,
  faUpload,
  faCog
} from '@fortawesome/free-solid-svg-icons'
import { useKMLLoader } from '../composables/useKMLLoader'
import { usePersistedLayers } from '../composables/usePersistedLayers'
import { useSupabaseLayers } from '../composables/useSupabaseLayers'
import SymbologyEditor from './SymbologyEditor.vue'

export default {
  name: 'LayerPanel',
  components: {
    FontAwesomeIcon,
    SymbologyEditor
  },
  setup() {
    const mapInstance = inject('mapInstance')
    const fileInput = ref(null)
    // Remove session layers - all layers are now persisted
    const loading = ref(false)
    const error = ref('')
    const showSymbologyEditor = ref(false)
    const selectedLayer = ref(null)

    const { parseKMLFile, parseKMZFile } = useKMLLoader()
    const { 
      persistedLayers, 
      addPersistedLayer, 
      removePersistedLayer, 
      updateLayerVisibility,
      updateLayerSymbology,
      getStorageInfo 
    } = usePersistedLayers()
    
    // Supabase permanent layers
    const {
      permanentLayers,
      fetchPermanentLayers,
      updatePermanentLayerVisibility,
      isLoading: supabaseLoading,
      hasError: supabaseError,
      error: supabaseErrorMessage
    } = useSupabaseLayers()

    // Combine permanent layers from Supabase with user-uploaded persisted layers
    const allLayers = computed(() => {
      const userLayers = persistedLayers.value.map(layer => ({ ...layer, isPersisted: true }))
      const supabaseLayers = permanentLayers.value.map(layer => ({ ...layer, isPermanent: true }))
      
      // Put permanent layers first, then user layers
      return [...supabaseLayers, ...userLayers]
    })

    const openFilePicker = () => {
      fileInput.value.click()
    }

    const handleFileSelect = async (event) => {
      const file = event.target.files[0]
      if (!file) return

      loading.value = true
      error.value = ''

      try {
        let layerData
        const fileName = file.name.toLowerCase()
        
        if (fileName.endsWith('.kml')) {
          layerData = await parseKMLFile(file)
        } else if (fileName.endsWith('.kmz')) {
          layerData = await parseKMZFile(file)
        } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
          const text = await file.text()
          layerData = JSON.parse(text)
          
          // Validate GeoJSON structure
          if (!layerData.type || layerData.type !== 'FeatureCollection') {
            throw new Error('Invalid GeoJSON format. File must be a FeatureCollection.')
          }
        } else {
          throw new Error('Unsupported file format. Please select a GeoJSON, KML, or KMZ file.')
        }

        const newLayer = {
          id: `layer_${Date.now()}`,
          name: file.name.replace(/\.(geojson|json|kml|kmz)$/i, ''),
          type: fileName.endsWith('.kml') ? 'KML' : 
                fileName.endsWith('.kmz') ? 'KMZ' : 'GeoJSON',
          visible: true,
          data: layerData,
          uploadDate: new Date().toISOString()
        }

        // Add to persistent storage
        const success = addPersistedLayer(newLayer)
        if (success) {
          addLayerToMap(newLayer)
          console.log(`Layer "${newLayer.name}" added to persistent storage`)
        } else {
          error.value = 'Failed to save layer to persistent storage'
        }

      } catch (err) {
        error.value = err.message || 'Failed to load layer'
        console.error('Layer loading error:', err)
      } finally {
        loading.value = false
        event.target.value = ''
      }
    }

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
      }
    }

    const toggleLayerVisibility = (layerId) => {
      if (!mapInstance.value) return

      // Check if it's a permanent layer or persisted layer
      const permanentLayer = permanentLayers.value.find(l => l.id === layerId)
      const persistedLayer = persistedLayers.value.find(l => l.id === layerId)
      
      let layer = permanentLayer || persistedLayer
      if (!layer) return

      layer.visible = !layer.visible
      
      // Update appropriate storage
      if (permanentLayer) {
        updatePermanentLayerVisibility(layerId, layer.visible)
      } else {
        updateLayerVisibility(layerId, layer.visible)
      }
      
      const map = mapInstance.value

      const layerIds = [
        `${layerId}-fill`,
        `${layerId}-stroke`, 
        `${layerId}-line`,
        `${layerId}-point`
      ]

      layerIds.forEach(id => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', layer.visible ? 'visible' : 'none')
        }
      })
    }

    const removeLayer = (layerId) => {
      // Check if it's a permanent layer or persisted layer
      const permanentLayer = permanentLayers.value.find(l => l.id === layerId)
      const persistedLayer = persistedLayers.value.find(l => l.id === layerId)
      
      let layer = permanentLayer || persistedLayer
      if (!layer) {
        console.warn(`Layer with id ${layerId} not found`)
        return
      }

      // Permanent layers cannot be deleted
      if (permanentLayer) {
        alert(`"${layer.name}" is a permanent layer and cannot be deleted. You can only hide/show it.`)
        return
      }

      // Confirm deletion for user-uploaded layers
      const confirmed = confirm(`Are you sure you want to permanently delete the layer "${layer.name}"?`)
      if (!confirmed) return

      // Remove from map
      if (mapInstance.value) {
        const map = mapInstance.value
        const layerIds = [
          `${layerId}-fill`,
          `${layerId}-stroke`, 
          `${layerId}-line`,
          `${layerId}-point`
        ]

        layerIds.forEach(id => {
          if (map.getLayer(id)) {
            map.removeLayer(id)
          }
        })

        if (map.getSource(layerId)) {
          map.removeSource(layerId)
        }
      }

      // Remove from persistent storage
      removePersistedLayer(layerId)
      console.log(`Permanently deleted layer: ${layer.name}`)
    }

    const clearError = () => {
      error.value = ''
      // Clear Supabase error through the composable if needed
      if (supabaseErrorMessage.value) {
        // Reset the error in the composable
        const { error: supabaseError } = useSupabaseLayers()
        supabaseError.value = null
      }
    }

    const openPropertiesModal = (layer) => {
      selectedLayer.value = layer
      showSymbologyEditor.value = true
    }

    const closeSymbologyEditor = () => {
      showSymbologyEditor.value = false
      selectedLayer.value = null
    }

    const applySymbology = (symbologyData) => {
      if (!selectedLayer.value || !mapInstance.value) return
      
      console.log('Applying symbology:', symbologyData)
      const layer = selectedLayer.value
      
      // Update layer styling based on categorical symbology
      updateLayerStyling(layer.id, symbologyData)
      
      // Persist the symbology settings
      persistLayerSymbology(layer.id, symbologyData)
      
      closeSymbologyEditor()
    }

    const onColorChange = (symbologyData) => {
      if (!selectedLayer.value || !mapInstance.value) return
      
      const layer = selectedLayer.value
      
      // Immediately update map styling without closing modal
      updateLayerStyling(layer.id, symbologyData)
      
      // Persist the symbology settings immediately
      persistLayerSymbology(layer.id, symbologyData)
    }

    const persistLayerSymbology = (layerId, symbologyData) => {
      // Check if it's a permanent layer or persisted layer
      const permanentLayer = permanentLayers.value.find(l => l.id === layerId)
      const persistedLayer = persistedLayers.value.find(l => l.id === layerId)
      
      if (permanentLayer) {
        // Store symbology in the permanent layer object
        permanentLayer.symbology = symbologyData
        console.log(`Persisted symbology for permanent layer: ${permanentLayer.name}`)
      } else if (persistedLayer) {
        // Store symbology in the persisted layer and save to localStorage
        updateLayerSymbology(layerId, symbologyData)
        console.log(`Persisted symbology for user layer: ${persistedLayer.name}`)
      }
    }

    const updateLayerStyling = (layerId, symbologyData) => {
      if (!mapInstance.value) return
      
      const map = mapInstance.value
      const { field, categories } = symbologyData
      
      // Create color expression for MapLibre GL JS
      const colorExpression = ['case']
      
      categories.forEach(category => {
        // Handle different data types properly
        const value = category.value
        if (value === '' || value === null || value === undefined) {
          // Handle empty/null values
          colorExpression.push(['any', ['==', ['get', field], ''], ['==', ['get', field], null], ['!', ['has', field]]])
        } else if (typeof value === 'number') {
          // Handle numeric values
          colorExpression.push(['==', ['to-number', ['get', field]], value])
        } else {
          // Handle string values
          colorExpression.push(['==', ['to-string', ['get', field]], String(value)])
        }
        colorExpression.push(category.color)
      })
      
      // Default color for unmatched values
      colorExpression.push('#cccccc')
      
      // Update existing layers with categorical styling
      const layerIds = [
        `${layerId}-fill`,
        `${layerId}-stroke`, 
        `${layerId}-line`,
        `${layerId}-point`
      ]
      
      layerIds.forEach(id => {
        if (map.getLayer(id)) {
          const layerType = map.getLayer(id).type
          
          if (layerType === 'fill') {
            map.setPaintProperty(id, 'fill-color', colorExpression)
          } else if (layerType === 'line') {
            map.setPaintProperty(id, 'line-color', colorExpression)
          } else if (layerType === 'circle') {
            map.setPaintProperty(id, 'circle-color', colorExpression)
          }
        }
      })
    }

    // Load all layers (permanent + persisted) to map when component mounts
    const loadAllLayersToMap = () => {
      if (!mapInstance.value) return
      
      // Load permanent layers from Supabase
      permanentLayers.value.forEach(layer => {
        if (layer.visible !== false) {
          addLayerToMap(layer)
          
          // Restore symbology from localStorage for permanent layers
          const storageKey = generateLayerKey(layer)
          const storedSymbology = storageKey ? getLayerSymbology(storageKey) : null
          
          if (storedSymbology) {
            layer.symbology = storedSymbology
            updateLayerStyling(layer.id, storedSymbology)
            console.log(`Restored symbology for permanent layer: ${layer.name}`)
          } else if (layer.symbology) {
            // Apply existing symbology if available
            updateLayerStyling(layer.id, layer.symbology)
          }
        }
      })
      
      // Load user-uploaded persisted layers
      persistedLayers.value.forEach(layer => {
        if (layer.visible !== false) {
          addLayerToMap(layer)
          
          // For user layers, symbology is already stored in the layer object
          // But also check unified storage for consistency
          const storageKey = generateLayerKey(layer)
          const storedSymbology = storageKey ? getLayerSymbology(storageKey) : null
          
          if (storedSymbology) {
            layer.symbology = storedSymbology
            updateLayerStyling(layer.id, storedSymbology)
            console.log(`Restored symbology for user layer: ${layer.name}`)
          } else if (layer.symbology) {
            // Apply existing symbology from layer storage
            updateLayerStyling(layer.id, layer.symbology)
          }
        }
      })
      
      const totalLayers = permanentLayers.value.length + persistedLayers.value.length
      console.log(`Loaded ${totalLayers} layers to map (${permanentLayers.value.length} permanent, ${persistedLayers.value.length} user-uploaded)`)
    }

    // Initialize all layers when component mounts
    onMounted(async () => {
      // First, fetch permanent layers from Supabase
      try {
        console.log('Fetching permanent layers from Supabase on component mount...')
        await fetchPermanentLayers()
      } catch (err) {
        console.error('Failed to fetch permanent layers on mount:', err)
        error.value = `Failed to load permanent layers: ${err.message}`
      }
      
      // Then load all layers to map when available
      if (mapInstance.value) {
        loadAllLayersToMap()
      } else {
        // Wait for map to be available
        const checkMap = setInterval(() => {
          if (mapInstance.value) {
            loadAllLayersToMap()
            clearInterval(checkMap)
          }
        }, 100)
        
        // Cleanup interval after 10 seconds
        setTimeout(() => clearInterval(checkMap), 10000)
      }
    })

    return {
      fileInput,
      layers: allLayers, // All layers are persisted
      loading,
      error,
      openFilePicker,
      handleFileSelect,
      toggleLayerVisibility,
      removeLayer,
      clearError,
      persistedLayers,
      getStorageInfo,
      openPropertiesModal,
      closeSymbologyEditor,
      applySymbology,
      onColorChange,
      showSymbologyEditor,
      selectedLayer,
      faPlus,
      faEye,
      faEyeSlash,
      faTrash,
      faLayerGroup,
      faExclamationTriangle,
      faDownload,
      faUpload,
      faCog
    }
  }
}
</script>

<style scoped>
.layer-panel {
  height: 100vh;
  background: #1294b9;
  color: #fcfcfc;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1;
  width: 100vw;
  max-width: 100vw;
  box-sizing: border-box;
}

.panel-header {
  padding: 2rem 1.5rem 1rem;
  border-bottom: 1px solid rgba(252, 252, 252, 0.2);
  flex-shrink: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.panel-content {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  max-width: 100%;
  box-sizing: border-box;
  padding-bottom: 6rem;
}

.add-layer-section {
  margin-bottom: 2rem;
}

.add-layer-button {
  width: 100%;
  padding: 1rem;
  background: rgba(252, 252, 252, 0.1);
  border: 2px dashed rgba(252, 252, 252, 0.3);
  border-radius: 12px;
  color: #fcfcfc;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.add-layer-button:hover {
  background: rgba(252, 252, 252, 0.2);
  border-color: rgba(252, 252, 252, 0.5);
}

.layers-list h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: rgba(252, 252, 252, 0.8);
}

.layer-item {
  background: rgba(252, 252, 252, 0.1);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.layer-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.layer-name {
  display: block;
  font-weight: 600;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.layer-type {
  font-size: 0.8rem;
  color: rgba(252, 252, 252, 0.6);
  text-transform: uppercase;
}

.layer-stored {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
}

.layer-permanent {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  background: rgba(255, 193, 7, 0.2);
  color: #f39c12;
}

.layer-controls {
  display: flex;
  gap: 0.5rem;
}

.properties-button,
.visibility-button,
.remove-button {
  background: none;
  border: none;
  color: rgba(252, 252, 252, 0.6);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.visibility-button.visible {
  color: #fcfcfc;
}

.properties-button:hover,
.visibility-button:hover,
.remove-button:hover {
  background: rgba(252, 252, 252, 0.1);
  color: #fcfcfc;
}

.properties-button:hover {
  color: #20b2aa;
}

.remove-button:hover {
  color: #ff6b6b;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: rgba(252, 252, 252, 0.6);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.3;
}

.empty-subtitle {
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(18, 148, 185, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  z-index: 100;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(252, 252, 252, 0.3);
  border-top: 3px solid #fcfcfc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  position: fixed;
  top: 2rem;
  left: 1rem;
  right: 1rem;
  max-width: calc(100vw - 2rem);
  background: #ff6b6b;
  color: white;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 200;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  box-sizing: border-box;
}

.close-error {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  margin-left: auto;
  padding: 0;
  line-height: 1;
}

.storage-info {
  margin-top: 2rem;
  padding: 1rem;
  background: rgba(252, 252, 252, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(252, 252, 252, 0.1);
}

.storage-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.storage-stats:last-child {
  margin-bottom: 0;
}

.storage-label {
  font-size: 0.85rem;
  color: rgba(252, 252, 252, 0.7);
}

.storage-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: #fcfcfc;
}
</style>