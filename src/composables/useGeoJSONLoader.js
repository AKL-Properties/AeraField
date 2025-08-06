import { ref, onMounted } from 'vue'

export function useGeoJSONLoader() {
  const geoJsonData = ref([])
  const loading = ref(true)
  const error = ref(null)

  const parseGPX = (gpxText) => {
    const parser = new DOMParser()
    const gpxDoc = parser.parseFromString(gpxText, 'application/xml')
    
    const tracks = gpxDoc.querySelectorAll('trk')
    const routes = gpxDoc.querySelectorAll('rte')
    const waypoints = gpxDoc.querySelectorAll('wpt')
    
    const features = []
    
    tracks.forEach(track => {
      const segments = track.querySelectorAll('trkseg')
      segments.forEach(segment => {
        const points = segment.querySelectorAll('trkpt')
        const coordinates = Array.from(points).map(pt => [
          parseFloat(pt.getAttribute('lon')),
          parseFloat(pt.getAttribute('lat'))
        ])
        
        if (coordinates.length > 0) {
          features.push({
            type: 'Feature',
            properties: {
              name: track.querySelector('name')?.textContent || 'Track',
              type: 'track'
            },
            geometry: {
              type: 'LineString',
              coordinates
            }
          })
        }
      })
    })
    
    routes.forEach(route => {
      const points = route.querySelectorAll('rtept')
      const coordinates = Array.from(points).map(pt => [
        parseFloat(pt.getAttribute('lon')),
        parseFloat(pt.getAttribute('lat'))
      ])
      
      if (coordinates.length > 0) {
        features.push({
          type: 'Feature',
          properties: {
            name: route.querySelector('name')?.textContent || 'Route',
            type: 'route'
          },
          geometry: {
            type: 'LineString',
            coordinates
          }
        })
      }
    })
    
    waypoints.forEach(waypoint => {
      features.push({
        type: 'Feature',
        properties: {
          name: waypoint.querySelector('name')?.textContent || 'Waypoint',
          type: 'waypoint'
        },
        geometry: {
          type: 'Point',
          coordinates: [
            parseFloat(waypoint.getAttribute('lon')),
            parseFloat(waypoint.getAttribute('lat'))
          ]
        }
      })
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
  
  const addGPXLayer = async (file) => {
    try {
      const text = await file.text()
      const parsedData = parseGPX(text)
      const layerName = file.name.replace('.gpx', '').replace(/[-_]/g, ' ')
      
      const newLayer = {
        name: layerName,
        filename: file.name,
        data: parsedData,
        type: 'gpx'
      }
      
      geoJsonData.value = [...geoJsonData.value, newLayer]
      return newLayer
    } catch (err) {
      console.error('Error adding GPX layer:', err)
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
    addGPXLayer
  }
}