import { ref, onMounted } from 'vue'

export function useLayerStyles() {
  const layerStyles = ref(new Map())
  const loading = ref(true)
  const error = ref(null)


  const loadCachedStyles = () => {
    try {
      const cachedStyles = localStorage.getItem('aerafield_cached_styles')
      const timestamp = localStorage.getItem('aerafield_styles_timestamp')

      if (!cachedStyles) {
        console.log('No cached styles found')
        return new Map()
      }

      const parsedData = JSON.parse(cachedStyles)
      const stylesMap = new Map()

      if (parsedData.features) {
        parsedData.features.forEach(feature => {
          const props = feature.properties
          stylesMap.set(props.layer_name, {
            layer_name: props.layer_name,
            fill_color: props.fill_color,
            fill_opacity: props.fill_opacity,
            stroke_color: props.stroke_color,
            stroke_width: props.stroke_width,
            stroke_opacity: props.stroke_opacity,
            point_color: props.point_color,
            point_radius: props.point_radius,
            point_stroke_color: props.point_stroke_color,
            point_stroke_width: props.point_stroke_width,
            created_at: props.created_at,
            updated_at: props.updated_at
          })
        })
      }

      layerStyles.value = stylesMap
      console.log(`Loaded ${stylesMap.size} cached layer styles from ${timestamp}`)
      return stylesMap
    } catch (err) {
      console.error('Error loading cached styles:', err)
      return new Map()
    }
  }

  const getStyleForLayer = (layerName) => {
    // Normalize layer name (remove file extension, convert to lowercase)
    const normalizedName = layerName.toLowerCase().replace(/\.(geojson|json)$/, '')
    
    // Try exact match first
    let style = layerStyles.value.get(layerName) || layerStyles.value.get(normalizedName)
    
    // If no exact match, try partial matches
    if (!style) {
      for (const [key, value] of layerStyles.value) {
        if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
          style = value
          break
        }
      }
    }

    // Return style or default values
    return style || {
      fill_color: 'rgba(18, 148, 185, 0.1)',
      fill_opacity: 0.2,
      stroke_color: '#1294b9',
      stroke_width: 3,
      stroke_opacity: 1,
      point_color: '#1294b9',
      point_radius: 6,
      point_stroke_color: '#ffffff',
      point_stroke_width: 2
    }
  }

  const initializeStyles = async () => {
    // Try to load cached styles first for immediate use
    loadCachedStyles()
  }

  onMounted(() => {
    initializeStyles()
  })

  return {
    layerStyles,
    loading,
    error,
    getStyleForLayer,
    loadCachedStyles
  }
}