import { useState, useEffect } from 'react'

export const useGeoJSONLoader = () => {
  const [geoJsonData, setGeoJsonData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadGeoJSONFiles = async () => {
      setLoading(true)
      setError(null)

      try {
        // Get list of GeoJSON files from the data directory
        // Since we can't dynamically read directory contents in the browser,
        // we'll need to maintain a list of available files
        const geoJsonFiles = [
          'Aera.geojson'
        ]

        const loadedData = []

        for (const filename of geoJsonFiles) {
          try {
            console.log(`Attempting to load: ${filename}`)
            const response = await fetch(`/data/${filename}`)
            console.log(`Response status for ${filename}:`, response.status, response.ok)
            if (response.ok) {
              const responseText = await response.text()
              try {
                const data = JSON.parse(responseText)
                const layerName = filename.replace('.geojson', '').replace(/[-_]/g, ' ')
                console.log(`Successfully loaded ${filename} with ${data.features?.length || 0} features`)
                loadedData.push({
                  name: layerName,
                  filename,
                  data
                })
              } catch (jsonError) {
                console.error(`Invalid JSON in ${filename}:`, jsonError)
                console.error(`Response content: ${responseText.substring(0, 200)}...`)
              }
            } else {
              console.warn(`Failed to fetch ${filename}: ${response.status} ${response.statusText}`)
            }
          } catch (fileError) {
            console.warn(`Failed to load ${filename}:`, fileError)
          }
        }

        setGeoJsonData(loadedData)
      } catch (err) {
        setError(err.message)
        console.error('Error loading GeoJSON files:', err)
      } finally {
        setLoading(false)
      }
    }

    loadGeoJSONFiles()
  }, [])

  return { geoJsonData, loading, error }
}