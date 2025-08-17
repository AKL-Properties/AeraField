import { ref, computed } from 'vue'

const STORAGE_KEY = 'aerafield_persisted_layers'

// Reactive state for persisted layers
const persistedLayers = ref([])

export function usePersistedLayers() {
  
  // Load persisted layers from localStorage on initialization
  const loadPersistedLayers = () => {
    try {
      const storedData = localStorage.getItem(STORAGE_KEY)
      if (storedData) {
        const parsed = JSON.parse(storedData)
        persistedLayers.value = Array.isArray(parsed) ? parsed : []
        console.log(`Loaded ${persistedLayers.value.length} persisted layers from localStorage`)
      }
    } catch (error) {
      console.error('Failed to load persisted layers from localStorage:', error)
      persistedLayers.value = []
    }
  }

  // Save layers to localStorage
  const saveToStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedLayers.value))
      console.log(`Saved ${persistedLayers.value.length} layers to localStorage`)
    } catch (error) {
      console.error('Failed to save layers to localStorage:', error)
      // Handle storage quota exceeded
      if (error.name === 'QuotaExceededError') {
        alert('Storage quota exceeded. Please delete some layers to free up space.')
      }
    }
  }

  // Add a new layer to persistent storage
  const addPersistedLayer = (layer) => {
    if (!layer || !layer.id || !layer.name || !layer.data) {
      console.error('Invalid layer data provided to addPersistedLayer')
      return false
    }

    // Check if layer already exists
    const existingIndex = persistedLayers.value.findIndex(l => l.id === layer.id)
    if (existingIndex !== -1) {
      console.warn(`Layer with id ${layer.id} already exists, updating...`)
      persistedLayers.value[existingIndex] = layer
    } else {
      persistedLayers.value.push(layer)
    }
    
    saveToStorage()
    return true
  }

  // Remove a layer from persistent storage
  const removePersistedLayer = (layerId) => {
    const index = persistedLayers.value.findIndex(l => l.id === layerId)
    if (index !== -1) {
      const removedLayer = persistedLayers.value.splice(index, 1)[0]
      saveToStorage()
      console.log(`Removed persisted layer: ${removedLayer.name}`)
      return removedLayer
    }
    return null
  }

  // Get a specific persisted layer by ID
  const getPersistedLayer = (layerId) => {
    return persistedLayers.value.find(l => l.id === layerId)
  }

  // Update layer visibility state
  const updateLayerVisibility = (layerId, visible) => {
    const layer = persistedLayers.value.find(l => l.id === layerId)
    if (layer) {
      layer.visible = visible
      saveToStorage()
    }
  }

  // Update layer symbology
  const updateLayerSymbology = (layerId, symbologyData) => {
    const layer = persistedLayers.value.find(l => l.id === layerId)
    if (layer) {
      layer.symbology = symbologyData
      saveToStorage()
      console.log(`Updated symbology for layer: ${layer.name}`)
      return true
    }
    return false
  }

  // Clear all persisted layers
  const clearAllPersistedLayers = () => {
    persistedLayers.value = []
    saveToStorage()
    console.log('Cleared all persisted layers')
  }

  // Get storage usage information
  const getStorageInfo = () => {
    try {
      const dataString = JSON.stringify(persistedLayers.value)
      const sizeInBytes = new Blob([dataString]).size
      const sizeInKB = (sizeInBytes / 1024).toFixed(2)
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2)
      
      return {
        layerCount: persistedLayers.value.length,
        sizeInBytes,
        sizeInKB,
        sizeInMB,
        formatted: sizeInBytes > 1024 * 1024 ? `${sizeInMB} MB` : `${sizeInKB} KB`
      }
    } catch (error) {
      console.error('Failed to calculate storage info:', error)
      return {
        layerCount: persistedLayers.value.length,
        sizeInBytes: 0,
        sizeInKB: '0',
        sizeInMB: '0',
        formatted: '0 KB'
      }
    }
  }

  // Export layers as backup
  const exportLayers = () => {
    try {
      const data = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        layers: persistedLayers.value
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `aerafield-layers-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      URL.revokeObjectURL(url)
      console.log('Layers exported successfully')
    } catch (error) {
      console.error('Failed to export layers:', error)
      alert('Failed to export layers. Please try again.')
    }
  }

  // Import layers from backup
  const importLayers = async (file) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      if (!data.layers || !Array.isArray(data.layers)) {
        throw new Error('Invalid backup file format')
      }
      
      // Validate layer structure
      const validLayers = data.layers.filter(layer => 
        layer && layer.id && layer.name && layer.data
      )
      
      if (validLayers.length === 0) {
        throw new Error('No valid layers found in backup file')
      }
      
      // Ask user if they want to replace or merge
      const replace = confirm(
        `Found ${validLayers.length} layers in backup file. ` +
        'Do you want to replace existing layers? ' +
        '(Cancel to merge with existing layers)'
      )
      
      if (replace) {
        persistedLayers.value = validLayers
      } else {
        // Merge layers, avoiding duplicates by ID
        validLayers.forEach(layer => {
          const existingIndex = persistedLayers.value.findIndex(l => l.id === layer.id)
          if (existingIndex !== -1) {
            persistedLayers.value[existingIndex] = layer
          } else {
            persistedLayers.value.push(layer)
          }
        })
      }
      
      saveToStorage()
      console.log(`Imported ${validLayers.length} layers successfully`)
      return validLayers.length
      
    } catch (error) {
      console.error('Failed to import layers:', error)
      throw new Error(`Import failed: ${error.message}`)
    }
  }

  // Computed properties for easy access
  const layerCount = computed(() => persistedLayers.value.length)
  const hasLayers = computed(() => persistedLayers.value.length > 0)
  const visibleLayers = computed(() => persistedLayers.value.filter(l => l.visible !== false))

  // Initialize by loading from storage
  loadPersistedLayers()

  return {
    // Reactive state
    persistedLayers,
    layerCount,
    hasLayers,
    visibleLayers,
    
    // Core operations
    addPersistedLayer,
    removePersistedLayer,
    getPersistedLayer,
    updateLayerVisibility,
    updateLayerSymbology,
    clearAllPersistedLayers,
    
    // Storage management
    loadPersistedLayers,
    saveToStorage,
    getStorageInfo,
    
    // Import/Export
    exportLayers,
    importLayers
  }
}