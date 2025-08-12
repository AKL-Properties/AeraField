import { ref, onMounted } from 'vue'
import JSZip from 'jszip'

export function useGeoJSONLoader() {
  const geoJsonData = ref([])
  const loading = ref(true)
  const error = ref(null)

  const parseKMZ = async (kmzFile) => {
    const zip = new JSZip()
    const unzipped = await zip.loadAsync(kmzFile)
    
    // Find the KML file in the KMZ archive (usually named doc.kml)
    let kmlContent = null
    for (const filename in unzipped.files) {
      if (filename.toLowerCase().endsWith('.kml')) {
        kmlContent = await unzipped.files[filename].async('text')
        break
      }
    }
    
    if (!kmlContent) {
      throw new Error('No KML file found in KMZ archive')
    }
    
    return parseKML(kmlContent)
  }
  
  const parseKML = (kmlText) => {
    const parser = new DOMParser()
    const kmlDoc = parser.parseFromString(kmlText, 'application/xml')
    
    const features = []
    
    // Parse LineStrings (tracks/routes)
    const lineStrings = kmlDoc.querySelectorAll('LineString')
    lineStrings.forEach(lineString => {
      const coordinates = lineString.querySelector('coordinates')
      if (coordinates) {
        const coordsText = coordinates.textContent.trim()
        const coordsArray = coordsText.split(/\s+/).map(coord => {
          const [lng, lat, alt] = coord.split(',').map(Number)
          return [lng, lat]
        }).filter(coord => coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1]))
        
        if (coordsArray.length > 0) {
          const placemark = lineString.closest('Placemark')
          const name = placemark?.querySelector('name')?.textContent || 'Route'
          
          features.push({
            type: 'Feature',
            properties: {
              name,
              type: 'track'
            },
            geometry: {
              type: 'LineString',
              coordinates: coordsArray
            }
          })
        }
      }
    })
    
    // Parse Points (waypoints)
    const points = kmlDoc.querySelectorAll('Point')
    points.forEach(point => {
      const coordinates = point.querySelector('coordinates')
      if (coordinates) {
        const coordsText = coordinates.textContent.trim()
        const [lng, lat] = coordsText.split(',').map(Number)
        
        if (!isNaN(lng) && !isNaN(lat)) {
          const placemark = point.closest('Placemark')
          const name = placemark?.querySelector('name')?.textContent || 'Point'
          
          features.push({
            type: 'Feature',
            properties: {
              name,
              type: 'waypoint'
            },
            geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            }
          })
        }
      }
    })
    
    return {
      type: 'FeatureCollection',
      features
    }
  }

  const validateGeoJSONStructure = (data, filename) => {
    if (!data) {
      throw new Error(`GeoJSON data is null or undefined for file: ${filename}`)
    }
    
    if (typeof data !== 'object') {
      throw new Error(`GeoJSON data is not an object for file: ${filename}`)
    }
    
    if (!data.type) {
      throw new Error(`Missing 'type' property in GeoJSON for file: ${filename}`)
    }
    
    if (data.type !== 'FeatureCollection') {
      throw new Error(`Invalid GeoJSON type '${data.type}' for file: ${filename}. Expected 'FeatureCollection'`)
    }
    
    if (!Array.isArray(data.features)) {
      throw new Error(`GeoJSON 'features' is not an array for file: ${filename}`)
    }
    
    // Check for null values in properties that might cause MapLibre errors
    let nullCoordinateCount = 0
    let invalidFeatureCount = 0
    
    data.features.forEach((feature, index) => {
      if (!feature) {
        invalidFeatureCount++
        return
      }
      
      if (!feature.geometry) {
        invalidFeatureCount++
        return
      }
      
      // Check for null coordinates that cause "Expected value to be of type number, but found null instead" errors
      if (!feature.geometry.coordinates || !Array.isArray(feature.geometry.coordinates)) {
        nullCoordinateCount++
        return
      }
      
      // Deep check for null coordinate values
      const hasNullCoordinates = JSON.stringify(feature.geometry.coordinates).includes('null')
      if (hasNullCoordinates) {
        nullCoordinateCount++
        console.warn(`Feature ${index} in ${filename} has null coordinates:`, feature.geometry.coordinates)
      }
      
      // Check for properties with null values that might affect styling
      if (feature.properties) {
        Object.entries(feature.properties).forEach(([key, value]) => {
          if (value === null && ['x', 'y', 'r', 'LONGITUDE', 'LATITUDE'].includes(key)) {
            console.warn(`Feature ${index} in ${filename} has null ${key} property`)
          }
        })
      }
    })
    
    if (nullCoordinateCount > 0) {
      console.warn(`Found ${nullCoordinateCount} features with null coordinates in ${filename}`)
    }
    
    if (invalidFeatureCount > 0) {
      console.warn(`Found ${invalidFeatureCount} invalid features in ${filename}`)
    }
    
    console.log(`GeoJSON validation complete for ${filename}:`, {
      totalFeatures: data.features.length,
      validFeatures: data.features.length - invalidFeatureCount - nullCoordinateCount,
      featuresWithNullCoordinates: nullCoordinateCount,
      invalidFeatures: invalidFeatureCount
    })
    
    return {
      isValid: true,
      stats: {
        totalFeatures: data.features.length,
        validFeatures: data.features.length - invalidFeatureCount - nullCoordinateCount,
        nullCoordinateCount,
        invalidFeatureCount
      }
    }
  }

  const sanitizeGeoJSONData = (data, filename) => {
    if (!data || !data.features) return data
    
    // Filter out features with null coordinates
    const originalCount = data.features.length
    data.features = data.features.filter(feature => {
      if (!feature || !feature.geometry || !feature.geometry.coordinates) {
        return false
      }
      
      // Check for null coordinates deep in the structure
      const coordinateString = JSON.stringify(feature.geometry.coordinates)
      if (coordinateString.includes('null')) {
        console.warn(`Removing feature with null coordinates from ${filename}`, feature)
        return false
      }
      
      return true
    })
    
    const filteredCount = data.features.length
    if (originalCount !== filteredCount) {
      console.log(`Sanitized ${filename}: removed ${originalCount - filteredCount} features with null coordinates`)
    }
    
    return data
  }

  const loadGeoJSONFiles = async () => {
    loading.value = true
    error.value = null

    try {
      console.group('🔍 GeoJSON Loader: Starting file loading process')
      
      const knownFiles = [
        'Aera.geojson'
      ]
      
      console.log(`🎯 Target files: ${knownFiles.join(', ')}`)
      console.log(`📍 Current URL: ${window.location.href}`)
      console.log(`🌐 Base URL for files: ${window.location.origin}/data/`)
      
      const loadedData = []
      let totalErrors = 0

      for (const filename of knownFiles) {
        try {
          const fileUrl = `/data/${filename}`
          console.group(`📄 Loading: ${filename}`)
          console.log(`🔗 Full URL: ${window.location.origin}${fileUrl}`)
          
          // Pre-flight check
          console.log('🚀 Starting fetch request...')
          const startTime = performance.now()
          
          const response = await fetch(fileUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json,application/geo+json,*/*'
            }
          })
          
          const fetchTime = performance.now() - startTime
          console.log(`⏱️ Fetch completed in ${fetchTime.toFixed(2)}ms`)
          console.log(`📊 Response status: ${response.status} ${response.statusText}`)
          console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()))
          
          if (!response.ok) {
            const errorDetails = {
              status: response.status,
              statusText: response.statusText,
              url: response.url,
              headers: Object.fromEntries(response.headers.entries())
            }
            console.error('❌ HTTP Error Details:', errorDetails)
            throw new Error(`HTTP ${response.status}: ${response.statusText} for ${filename}`)
          }
          
          console.log('📥 Reading response text...')
          const textStartTime = performance.now()
          const text = await response.text()
          const textTime = performance.now() - textStartTime
          
          console.log(`📄 Text read in ${textTime.toFixed(2)}ms, length: ${text.length} characters`)
          
          if (!text || text.trim() === '') {
            console.error('❌ Empty file content')
            throw new Error(`Empty file content for ${filename}`)
          }
          
          // Show first and last 100 characters for debugging
          console.log('📝 Content preview (first 100 chars):', text.substring(0, 100))
          console.log('📝 Content preview (last 100 chars):', text.substring(text.length - 100))
          
          let data
          try {
            console.log('🔧 Parsing JSON...')
            const parseStartTime = performance.now()
            data = JSON.parse(text)
            const parseTime = performance.now() - parseStartTime
            console.log(`✅ JSON parsed successfully in ${parseTime.toFixed(2)}ms`)
            
            console.log('📋 GeoJSON structure:', {
              type: data.type,
              name: data.name,
              crs: data.crs?.type,
              featuresCount: data.features?.length || 0,
              firstFeatureType: data.features?.[0]?.geometry?.type,
              firstFeatureProps: Object.keys(data.features?.[0]?.properties || {}).slice(0, 5)
            })
            
          } catch (parseError) {
            console.error('❌ JSON Parse Error:', {
              message: parseError.message,
              name: parseError.name,
              stack: parseError.stack?.split('\n').slice(0, 3)
            })
            throw new Error(`JSON parsing failed for ${filename}: ${parseError.message}`)
          }
          
          // Validate GeoJSON structure
          console.log('🔍 Validating GeoJSON structure...')
          const validation = validateGeoJSONStructure(data, filename)
          console.log('✅ Validation completed:', validation.stats)
          
          // Sanitize data to remove null coordinates
          console.log('🧹 Sanitizing GeoJSON data...')
          const sanitizedData = sanitizeGeoJSONData(data, filename)
          console.log('✅ Sanitization completed')
          
          const layerName = filename.replace('.geojson', '').replace(/[-_]/g, ' ')
          const loadedItem = {
            name: layerName,
            filename,
            data: sanitizedData,
            type: 'geojson',
            stats: validation.stats
          }
          
          loadedData.push(loadedItem)
          
          console.log(`✅ ${filename} loaded successfully:`, {
            layerName,
            originalFeatures: data.features?.length || 0,
            validFeatures: validation.stats.validFeatures,
            nullCoordinates: validation.stats.nullCoordinateCount,
            invalidFeatures: validation.stats.invalidFeatureCount
          })
          
          console.groupEnd()
          
        } catch (fileError) {
          totalErrors++
          console.error(`❌ Failed to load ${filename}:`, {
            error: fileError.message,
            name: fileError.name,
            stack: fileError.stack?.split('\n').slice(0, 3)
          })
          
          // Additional debugging info
          try {
            const testResponse = await fetch(`/data/${filename}`, { method: 'HEAD' })
            console.log('🔍 HEAD request test:', {
              status: testResponse.status,
              headers: Object.fromEntries(testResponse.headers.entries())
            })
          } catch (headError) {
            console.log('🔍 HEAD request failed:', headError.message)
          }
          
          console.groupEnd()
          
          // Don't break the entire loading process for one file
          if (totalErrors < knownFiles.length) {
            console.log(`➡️ Continuing with remaining files...`)
          }
        }
      }

      console.log('📊 Loading Summary:', {
        totalFiles: knownFiles.length,
        successfulFiles: loadedData.length,
        failedFiles: totalErrors
      })

      if (loadedData.length === 0) {
        const errorMsg = `No GeoJSON files could be loaded successfully. Attempted: ${knownFiles.join(', ')}`
        console.error('❌ Complete loading failure:', errorMsg)
        throw new Error(errorMsg)
      }
      
      if (totalErrors > 0) {
        const warningMsg = `Loaded ${loadedData.length} files with ${totalErrors} errors`
        console.warn(`⚠️ ${warningMsg}`)
      }
      
      geoJsonData.value = loadedData
      console.log('🎉 GeoJSON loading completed successfully:', {
        successfulFiles: loadedData.length,
        errorCount: totalErrors,
        files: loadedData.map(item => ({ 
          name: item.name, 
          stats: item.stats,
          filename: item.filename 
        }))
      })
      
      console.groupEnd()
      
    } catch (err) {
      error.value = err.message
      console.error('💥 Critical error in GeoJSON loading:', {
        error: err.message,
        name: err.name,
        stack: err.stack?.split('\n').slice(0, 5),
        currentData: geoJsonData.value.length
      })
      
      // If we have some data loaded, don't clear it completely
      if (geoJsonData.value.length === 0) {
        geoJsonData.value = []
      }
      
      console.groupEnd()
    } finally {
      loading.value = false
      console.log(`🏁 GeoJSON loader finished. Loading: ${loading.value}, Data: ${geoJsonData.value.length} items`)
    }
  }
  
  const addKMZLayer = async (file) => {
    try {
      const parsedData = await parseKMZ(file)
      const layerName = file.name.replace('.kmz', '').replace(/[-_]/g, ' ')
      
      const newLayer = {
        name: layerName,
        filename: file.name,
        data: parsedData,
        type: 'kmz'
      }
      
      geoJsonData.value = [...geoJsonData.value, newLayer]
      return newLayer
    } catch (err) {
      console.error('Error adding KMZ layer:', err)
      throw err
    }
  }

  onMounted(() => {
    loadGeoJSONFiles()
  })

  return { 
    geoJsonData, 
    loading, 
    error,
    reload: loadGeoJSONFiles,
    addKMZLayer
  }
}