import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

const permanentLayers = ref([])
const loading = ref(false)
const error = ref(null)

export function useSupabaseLayers() {
  
  // Fetch layer style from shared_styles table by layer name
  const fetchLayerStyle = async (layerName) => {
    try {
      const { data: styles, error } = await supabase
        .from('shared_styles')
        .select('*')
        .eq('layer_name', layerName)
        .limit(1)
      
      if (error) {
        console.warn(`Failed to fetch style for layer ${layerName}:`, error)
        return null
      }
      
      if (styles && styles.length > 0) {
        console.log(`Loaded style for layer ${layerName}:`, styles[0])
        return styles[0]
      }
      
      console.log(`No style found for layer ${layerName}`)
      return null
    } catch (styleError) {
      console.warn(`Error fetching style for layer ${layerName}:`, styleError)
      return null
    }
  }
  
  // Fetch all permanent layers from the aeralink bucket
  const fetchPermanentLayers = async () => {
    loading.value = true
    error.value = null
    
    try {
      console.log('Fetching permanent layers from Supabase aeralink bucket...')
      
      // List all files in the aeralink bucket
      const { data: files, error: listError } = await supabase.storage
        .from('aeralink')
        .list()
      
      if (listError) {
        throw new Error(`Failed to list files in aeralink bucket: ${listError.message}`)
      }
      
      if (!files || files.length === 0) {
        console.log('No files found in aeralink bucket')
        permanentLayers.value = []
        return []
      }
      
      console.log(`Found ${files.length} files in aeralink bucket:`, files.map(f => f.name))
      
      // Filter for GeoJSON files (.geojson and .json extensions)
      const geoJsonFiles = files.filter(file => 
        file.name.toLowerCase().endsWith('.geojson') || 
        file.name.toLowerCase().endsWith('.json')
      )
      
      if (geoJsonFiles.length === 0) {
        console.log('No GeoJSON files found in aeralink bucket')
        permanentLayers.value = []
        return []
      }
      
      console.log(`Found ${geoJsonFiles.length} GeoJSON files:`, geoJsonFiles.map(f => f.name))
      
      // Fetch and parse each GeoJSON file
      const layerPromises = geoJsonFiles.map(async (file) => {
        try {
          console.log(`Downloading file: ${file.name}`)
          
          // Download file content from bucket
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('aeralink')
            .download(file.name)
          
          if (downloadError) {
            console.error(`Failed to download ${file.name}:`, downloadError)
            return null
          }
          
          // Convert blob to text
          const fileText = await fileData.text()
          
          // Parse GeoJSON
          const geoJsonData = JSON.parse(fileText)
          
          // Validate GeoJSON structure
          if (!geoJsonData.type || geoJsonData.type !== 'FeatureCollection') {
            console.warn(`Invalid GeoJSON format in ${file.name}: missing or incorrect type`)
            return null
          }
          
          if (!geoJsonData.features || !Array.isArray(geoJsonData.features)) {
            console.warn(`Invalid GeoJSON format in ${file.name}: missing or invalid features array`)
            return null
          }
          
          // Get layer name from file name
          const layerName = file.name.replace(/\.(geojson|json)$/i, '')
          
          // Fetch style from shared_styles table for this layer
          const layerStyle = await fetchLayerStyle(layerName)
          
          // Create layer object
          const layer = {
            id: `permanent_${layerName}_${Date.now()}`,
            name: layerName,
            type: 'GeoJSON',
            source: 'supabase_aeralink',
            visible: true,
            permanent: true, // Mark as permanent layer
            data: geoJsonData,
            defaultStyle: layerStyle, // Store the loaded style from shared_styles table
            fileName: file.name,
            fileSize: file.metadata?.size || fileData.size,
            lastModified: file.updated_at || file.created_at,
            loadedAt: new Date().toISOString()
          }
          
          console.log(`Successfully loaded layer: ${layer.name} (${geoJsonData.features.length} features)`)
          return layer
          
        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError)
          return null
        }
      })
      
      // Wait for all files to be processed
      const results = await Promise.all(layerPromises)
      
      // Filter out failed downloads and add to permanent layers
      const validLayers = results.filter(layer => layer !== null)
      permanentLayers.value = validLayers
      
      console.log(`Successfully loaded ${validLayers.length} permanent layers from Supabase`)
      
      if (validLayers.length !== geoJsonFiles.length) {
        const failedCount = geoJsonFiles.length - validLayers.length
        console.warn(`${failedCount} files failed to load properly`)
      }
      
      return validLayers
      
    } catch (fetchError) {
      console.error('Failed to fetch permanent layers from Supabase:', fetchError)
      error.value = `Failed to fetch permanent layers: ${fetchError.message}`
      permanentLayers.value = []
      return []
    } finally {
      loading.value = false
    }
  }
  
  // Get a specific permanent layer by ID
  const getPermanentLayer = (layerId) => {
    return permanentLayers.value.find(layer => layer.id === layerId)
  }
  
  // Update layer visibility (for UI state only - doesn't affect Supabase)
  const updatePermanentLayerVisibility = (layerId, visible) => {
    const layer = permanentLayers.value.find(l => l.id === layerId)
    if (layer) {
      layer.visible = visible
      console.log(`Updated permanent layer ${layer.name} visibility to ${visible}`)
    }
  }
  
  // Refresh layers from Supabase (re-fetch)
  const refreshPermanentLayers = async () => {
    console.log('Refreshing permanent layers from Supabase...')
    return await fetchPermanentLayers()
  }
  
  // Get summary information about permanent layers
  const getLayerSummary = () => {
    const totalFeatures = permanentLayers.value.reduce((sum, layer) => {
      return sum + (layer.data?.features?.length || 0)
    }, 0)
    
    const totalSize = permanentLayers.value.reduce((sum, layer) => {
      return sum + (layer.fileSize || 0)
    }, 0)
    
    return {
      layerCount: permanentLayers.value.length,
      totalFeatures,
      totalSize,
      formattedSize: formatFileSize(totalSize),
      visibleLayerCount: permanentLayers.value.filter(l => l.visible).length
    }
  }
  
  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    
    const units = ['B', 'KB', 'MB', 'GB']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
  }
  
  // Computed properties
  const layerCount = computed(() => permanentLayers.value.length)
  const hasLayers = computed(() => permanentLayers.value.length > 0)
  const visibleLayers = computed(() => permanentLayers.value.filter(l => l.visible !== false))
  const isLoading = computed(() => loading.value)
  const hasError = computed(() => error.value !== null)
  
  return {
    // Reactive state
    permanentLayers,
    loading,
    error,
    layerCount,
    hasLayers,
    visibleLayers,
    isLoading,
    hasError,
    
    // Core operations
    fetchPermanentLayers,
    getPermanentLayer,
    updatePermanentLayerVisibility,
    refreshPermanentLayers,
    
    // Utility functions
    getLayerSummary,
    formatFileSize
  }
}