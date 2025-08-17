import { ref, computed } from 'vue'

const SYMBOLOGY_STORAGE_KEY = 'aerafield_layer_symbology'

// Reactive state for layer symbology storage
const layerSymbologyStore = ref({})

export function useLayerSymbology() {
  
  // Load all stored symbology from localStorage on initialization
  const loadStoredSymbology = () => {
    try {
      const storedData = localStorage.getItem(SYMBOLOGY_STORAGE_KEY)
      if (storedData) {
        const parsed = JSON.parse(storedData)
        layerSymbologyStore.value = parsed || {}
        console.log(`Loaded symbology for ${Object.keys(layerSymbologyStore.value).length} layers from localStorage`)
      }
    } catch (error) {
      console.error('Failed to load stored symbology from localStorage:', error)
      layerSymbologyStore.value = {}
    }
  }

  // Save all symbology to localStorage
  const saveSymbologyToStorage = () => {
    try {
      localStorage.setItem(SYMBOLOGY_STORAGE_KEY, JSON.stringify(layerSymbologyStore.value))
      console.log(`Saved symbology for ${Object.keys(layerSymbologyStore.value).length} layers to localStorage`)
    } catch (error) {
      console.error('Failed to save symbology to localStorage:', error)
      if (error.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded while saving symbology')
      }
    }
  }

  // Store symbology for a specific layer
  const storeLayerSymbology = (layerId, symbologyData) => {
    if (!layerId || !symbologyData) {
      console.error('Invalid parameters for storeLayerSymbology')
      return false
    }

    layerSymbologyStore.value[layerId] = {
      ...symbologyData,
      lastUpdated: new Date().toISOString()
    }
    
    saveSymbologyToStorage()
    console.log(`Stored symbology for layer: ${layerId}`)
    return true
  }

  // Get stored symbology for a specific layer
  const getLayerSymbology = (layerId) => {
    if (!layerId) return null
    return layerSymbologyStore.value[layerId] || null
  }

  // Remove symbology for a specific layer
  const removeLayerSymbology = (layerId) => {
    if (!layerId) return false
    
    if (layerSymbologyStore.value[layerId]) {
      delete layerSymbologyStore.value[layerId]
      saveSymbologyToStorage()
      console.log(`Removed symbology for layer: ${layerId}`)
      return true
    }
    return false
  }

  // Check if a layer has stored symbology
  const hasLayerSymbology = (layerId) => {
    return !!(layerId && layerSymbologyStore.value[layerId])
  }

  // Get all stored symbology as a backup-friendly format
  const getAllSymbology = () => {
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      symbology: layerSymbologyStore.value
    }
  }

  // Import symbology from backup data
  const importSymbology = (symbologyData) => {
    try {
      if (!symbologyData || typeof symbologyData !== 'object') {
        throw new Error('Invalid symbology data format')
      }

      // Handle different import formats
      let symbologyToImport = {}
      if (symbologyData.symbology) {
        // New format with metadata
        symbologyToImport = symbologyData.symbology
      } else {
        // Direct symbology object
        symbologyToImport = symbologyData
      }

      layerSymbologyStore.value = { ...layerSymbologyStore.value, ...symbologyToImport }
      saveSymbologyToStorage()
      console.log(`Imported symbology for ${Object.keys(symbologyToImport).length} layers`)
      return Object.keys(symbologyToImport).length
    } catch (error) {
      console.error('Failed to import symbology:', error)
      throw new Error(`Import failed: ${error.message}`)
    }
  }

  // Clear all stored symbology
  const clearAllSymbology = () => {
    layerSymbologyStore.value = {}
    saveSymbologyToStorage()
    console.log('Cleared all stored symbology')
  }

  // Get storage statistics
  const getSymbologyStorageInfo = () => {
    try {
      const dataString = JSON.stringify(layerSymbologyStore.value)
      const sizeInBytes = new Blob([dataString]).size
      const sizeInKB = (sizeInBytes / 1024).toFixed(2)
      
      return {
        layerCount: Object.keys(layerSymbologyStore.value).length,
        sizeInBytes,
        sizeInKB,
        formatted: `${sizeInKB} KB`
      }
    } catch (error) {
      console.error('Failed to calculate symbology storage info:', error)
      return {
        layerCount: Object.keys(layerSymbologyStore.value).length,
        sizeInBytes: 0,
        sizeInKB: '0',
        formatted: '0 KB'
      }
    }
  }

  // Apply symbology to a layer (restore saved settings)
  const applyStoredSymbologyToLayer = (layer) => {
    if (!layer || !layer.id) return null
    
    const storedSymbology = getLayerSymbology(layer.id)
    if (storedSymbology) {
      console.log(`Restoring symbology for layer: ${layer.name}`)
      return storedSymbology
    }
    
    return null
  }

  // Generate a unique key for layer identification
  const generateLayerKey = (layer) => {
    if (!layer) return null
    
    // For permanent layers, use name + source for consistency
    if (layer.isPermanent || layer.permanent) {
      return `permanent_${layer.name}`
    }
    
    // For user layers, use the layer ID
    return layer.id
  }

  // Computed properties
  const storedLayerCount = computed(() => Object.keys(layerSymbologyStore.value).length)
  const hasStoredSymbology = computed(() => Object.keys(layerSymbologyStore.value).length > 0)

  // Initialize by loading from storage
  loadStoredSymbology()

  return {
    // Reactive state
    layerSymbologyStore,
    storedLayerCount,
    hasStoredSymbology,
    
    // Core operations
    storeLayerSymbology,
    getLayerSymbology,
    removeLayerSymbology,
    hasLayerSymbology,
    applyStoredSymbologyToLayer,
    generateLayerKey,
    
    // Storage management
    loadStoredSymbology,
    saveSymbologyToStorage,
    getSymbologyStorageInfo,
    
    // Bulk operations
    getAllSymbology,
    importSymbology,
    clearAllSymbology
  }
}