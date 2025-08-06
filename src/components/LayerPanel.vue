<template>
  <div class="layer-view">
    <div class="layer-header">
      <h2>Layer Manager</h2>
      <div class="layer-count">
        Layers: {{ geoJsonData.length }}
      </div>
    </div>

    <div class="add-layer-section">
      <input
        ref="fileInput"
        type="file"
        accept=".gpx"
        @change="handleFileUpload"
        style="display: none;"
      />
      <button
        @click="$refs.fileInput.click()"
        class="add-layer-button"
      >
        📍 Add GPX Layer
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      Loading layers...
    </div>

    <div v-else-if="geoJsonData.length === 0" class="empty-state">
      <div class="empty-icon">📂</div>
      <p>No layers found.</p>
      <p class="empty-subtitle">
        Add .geojson files to the /data directory or upload GPX files.
      </p>
    </div>

    <div v-else class="layers-list">
      <div
        v-for="{ name, filename, type } in geoJsonData"
        :key="name"
        class="layer-item"
      >
        <div class="layer-info">
          <h4 class="layer-name">{{ name }}</h4>
          <p class="layer-filename">
            <span class="layer-type">{{ type?.toUpperCase() || 'GEOJSON' }}</span>
            {{ filename }}
          </p>
        </div>

        <button
          @click="toggleLayer(name)"
          @touchstart="handleToggleTouch"
          @touchend="handleToggleTouchEnd"
          :class="['toggle-button', { active: layerVisibility[name] }]"
        >
          {{ layerVisibility[name] ? 'ON' : 'OFF' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, inject } from 'vue'
import { useGeoJSONLoader } from '../composables/useGeoJSONLoader'

export default {
  name: 'LayerPanel',
  props: {
    mapRef: Object
  },
  setup(props) {
    const { geoJsonData, loading, addGPXLayer } = useGeoJSONLoader()
    const layerVisibility = ref({})
    
    const mapInstance = inject('mapInstance', null)

    watch(geoJsonData, (newData) => {
      const initialVisibility = {}
      newData.forEach(({ name }) => {
        initialVisibility[name] = true
      })
      layerVisibility.value = initialVisibility
    }, { immediate: true })

    const toggleLayer = (layerName) => {
      const newVisibility = !layerVisibility.value[layerName]
      layerVisibility.value[layerName] = newVisibility

      if (props.mapRef && props.mapRef.toggleLayer) {
        props.mapRef.toggleLayer(layerName, newVisibility)
      }
      
      if (mapInstance?.value && mapInstance.value.toggleLayer) {
        mapInstance.value.toggleLayer(layerName, newVisibility)
      }
    }


    const handleToggleTouch = (event) => {
      event.target.style.transform = 'scale(0.95)'
    }

    const handleToggleTouchEnd = (event) => {
      event.target.style.transform = 'scale(1)'
    }

    const handleFileUpload = async (event) => {
      const file = event.target.files[0]
      if (file && file.name.toLowerCase().endsWith('.gpx')) {
        try {
          const newLayer = await addGPXLayer(file)
          layerVisibility.value[newLayer.name] = true
          
          if (props.mapRef && props.mapRef.addLayer) {
            props.mapRef.addLayer(newLayer.name, newLayer.data)
          }
          
          if (mapInstance?.value && mapInstance.value.addLayer) {
            mapInstance.value.addLayer(newLayer.name, newLayer.data)
          }
        } catch (error) {
          console.error('Failed to upload GPX file:', error)
          alert('Failed to load GPX file. Please check the file format.')
        }
      }
      event.target.value = ''
    }

    return {
      geoJsonData,
      loading,
      layerVisibility,
      toggleLayer,
      handleToggleTouch,
      handleToggleTouchEnd,
      handleFileUpload
    }
  }
}
</script>

<style scoped>
.layer-view {
  padding: 1rem;
  padding-bottom: 100px;
  min-height: 100vh;
  background: #1394b9;
  color: #fcfcfc;
}

.layer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.layer-header h2 {
  margin: 0;
  color: #fcfcfc;
  font-size: 1.5rem;
  font-weight: 600;
}

.layer-count {
  background: rgba(252, 252, 252, 0.2);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
}

.add-layer-section {
  margin-bottom: 2rem;
}

.add-layer-button {
  width: 100%;
  padding: 1rem;
  background: rgba(252, 252, 252, 0.2);
  border: 1px solid rgba(252, 252, 252, 0.2);
  border-radius: 12px;
  color: #fcfcfc;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.add-layer-button:hover {
  background: rgba(252, 252, 252, 0.3);
  transform: translateY(-1px);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: rgba(252, 252, 252, 0.7);
  gap: 1rem;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(252, 252, 252, 0.3);
  border-top: 2px solid #fcfcfc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: rgba(252, 252, 252, 0.7);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  color: rgba(252, 252, 252, 0.3);
}

.empty-state p {
  margin: 0.5rem 0;
  font-size: 1.1rem;
}

.empty-subtitle {
  font-size: 0.9rem !important;
  color: rgba(252, 252, 252, 0.5) !important;
}

.layers-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.layer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  background: rgba(252, 252, 252, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(252, 252, 252, 0.2);
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.layer-info {
  flex: 1;
}

.layer-name {
  margin: 0 0 0.5rem 0;
  color: #fcfcfc;
  font-size: 1.1rem;
  font-weight: 600;
  text-transform: capitalize;
}

.layer-filename {
  margin: 0;
  color: rgba(252, 252, 252, 0.7);
  font-size: 0.9rem;
}

.layer-type {
  display: inline-block;
  background: rgba(252, 252, 252, 0.2);
  color: #fcfcfc;
  padding: 0.2rem 0.6rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-right: 0.5rem;
  text-transform: uppercase;
}

.toggle-button {
  background: rgba(252, 252, 252, 0.1);
  border: 1px solid rgba(252, 252, 252, 0.2);
  border-radius: 20px;
  padding: 0.75rem 1.25rem;
  color: #fcfcfc;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  min-width: 70px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.toggle-button.active {
  background: linear-gradient(135deg, #fcfcfc, #e0f3f8);
  border: none;
  box-shadow: 0 4px 15px rgba(252, 252, 252, 0.3);
  color: #1394b9;
  transform: translateY(-1px);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>