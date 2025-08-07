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

  const loadGeoJSONFiles = async () => {
    loading.value = true
    error.value = null

    try {
      const knownFiles = [
        'Aera.geojson'
      ]
      
      const loadedData = []

      for (const filename of knownFiles) {
        try {
          const response = await fetch(`/data/${filename}`)
          if (response.ok) {
            const data = await response.json()
            const layerName = filename.replace('.geojson', '').replace(/[-_]/g, ' ')
            loadedData.push({
              name: layerName,
              filename,
              data,
              type: 'geojson'
            })
          }
        } catch (fileError) {
          console.warn(`Failed to load ${filename}:`, fileError)
        }
      }

      geoJsonData.value = loadedData
    } catch (err) {
      error.value = err.message
      console.error('Error loading layer files:', err)
    } finally {
      loading.value = false
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