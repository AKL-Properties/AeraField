<template>
  <div class="settings-view">
    <h2 class="settings-title">Settings</h2>
    
    <div class="settings-card">
      <p class="user-info">
        Logged in as: <strong class="user-email">{{ user?.email }}</strong>
      </p>
      <button @click="handleSignOut" class="sign-out-button">
        Sign Out
      </button>
    </div>

    <div class="settings-card photo-export-card">
      <h3 class="card-title">Photo Export</h3>
      <div class="photo-export-info">
        <p>Session Photos: <strong>{{ sessionPhotos.length }}</strong></p>
        <p v-if="geotaggedPhotosCount > 0">
          Geotagged: <strong>{{ geotaggedPhotosCount }}</strong>
        </p>
      </div>
      
      <div class="export-buttons">
        <button 
          @click="exportZIP" 
          :disabled="sessionPhotos.length === 0"
          class="export-button zip-button"
        >
          <i class="fas fa-download button-icon"></i>
          Export ZIP
        </button>
        
        <button 
          @click="exportKMZ" 
          :disabled="geotaggedPhotosCount === 0"
          class="export-button kmz-button"
        >
          <i class="fas fa-map button-icon"></i>
          Export KMZ
        </button>
      </div>
    </div>


    <div class="settings-card cache-card">
      <h3 class="card-title">Cache Management</h3>
      <div class="cache-info" v-if="cacheInfo">
        <p>Cached Data:</p>
        <ul class="cache-list">
          <li v-for="(cache, name) in cacheInfo" :key="name">
            <strong>{{ name }}:</strong> {{ cache.entryCount }} items
          </li>
        </ul>
      </div>
      
      <div class="cache-buttons">
        <button 
          @click="clearTilesCache" 
          :disabled="clearingCache"
          class="cache-button tiles-button"
        >
          <i class="fas fa-map button-icon"></i>
          {{ clearingCache ? 'Clearing...' : 'Clear Map Tiles' }}
        </button>
        
        <button 
          @click="clearAllCaches" 
          :disabled="clearingCache"
          class="cache-button clear-all-button"
        >
          <i class="fas fa-trash button-icon"></i>
          {{ clearingCache ? 'Clearing...' : 'Clear All Cache' }}
        </button>
      </div>
      
      <p class="cache-description">
        Clear map tiles to refresh basemap data, or clear all cache to reset the app completely (requires reload).
      </p>
    </div>

    <div class="settings-card info-card">
      <button @click="showInformationModal" class="information-button" title="Information">
        <font-awesome-icon :icon="['fas', 'info']" />
      </button>
    </div>

    <InformationModal 
      :isOpen="isInformationModalOpen" 
      @close="closeInformationModal" 
    />
  </div>
</template>

<script>
import { inject, ref, computed, onMounted, watch } from 'vue'
import InformationModal from './InformationModal.vue'
import { useSessionPhotos } from '../composables/useSessionPhotos'

export default {
  name: 'SettingsView',
  components: {
    InformationModal
  },
  props: ['mapRef'],
  setup(props) {
    const { user, signOut } = inject('auth')
    const mapInstance = inject('mapInstance', null)
    const isInformationModalOpen = ref(false)
    
    // Session photo management
    const { sessionPhotos, exportPhotosAsZip, exportPhotosAsKMZ } = useSessionPhotos()
    
    
    const geotaggedPhotosCount = computed(() => {
      return sessionPhotos.value.filter(photo => photo.location).length
    })

    // Cache management
    const cacheInfo = ref(null)
    const clearingCache = ref(false)

    // Service worker communication helper
    const sendMessageToServiceWorker = (message) => {
      return new Promise(async (resolve, reject) => {
        // Wait for service worker to be ready if it's not yet active
        if (!navigator.serviceWorker.controller) {
          try {
            // Wait for service worker to become ready
            await navigator.serviceWorker.ready
            
            // Check again after waiting
            if (!navigator.serviceWorker.controller) {
              reject(new Error('Service worker is not controlling this page'))
              return
            }
          } catch (error) {
            reject(new Error('Service worker not available: ' + error.message))
            return
          }
        }

        const messageChannel = new MessageChannel()
        messageChannel.port1.onmessage = (event) => {
          if (event.data.success) {
            resolve(event.data)
          } else {
            reject(new Error(event.data.message))
          }
        }

        navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2])
      })
    }

    // Get cache information
    const loadCacheInfo = async () => {
      try {
        const response = await sendMessageToServiceWorker({ type: 'GET_CACHE_INFO' })
        cacheInfo.value = response.cacheInfo
      } catch (error) {
        console.error('Failed to load cache info:', error)
      }
    }

    // Clear tiles cache only
    const clearTilesCache = async () => {
      if (!confirm('Clear map tiles cache? This will remove cached map tiles but keep other app data.')) {
        return
      }

      clearingCache.value = true
      try {
        await sendMessageToServiceWorker({ type: 'CLEAR_TILES_CACHE' })
        alert('Map tiles cache cleared successfully! The app will reload fresh tiles from the server.')
        await loadCacheInfo() // Refresh cache info
      } catch (error) {
        console.error('Failed to clear tiles cache:', error)
        alert(`Failed to clear tiles cache: ${error.message}`)
      } finally {
        clearingCache.value = false
      }
    }

    // Clear all caches
    const clearAllCaches = async () => {
      if (!confirm('Clear all cache and reset the app? This will remove all cached data and the page will reload.')) {
        return
      }

      clearingCache.value = true
      try {
        await sendMessageToServiceWorker({ type: 'CLEAR_ALL_CACHES' })
        alert('All caches cleared successfully! The page will now reload.')
        // Force reload after clearing all caches
        window.location.reload()
      } catch (error) {
        console.error('Failed to clear all caches:', error)
        alert(`Failed to clear all caches: ${error.message}`)
      } finally {
        clearingCache.value = false
      }
    }

    const handleSignOut = async () => {
      await signOut()
    }

    const showInformationModal = () => {
      isInformationModalOpen.value = true
    }

    const closeInformationModal = () => {
      isInformationModalOpen.value = false
    }


    // Export functions
    const exportZIP = async () => {
      try {
        await exportPhotosAsZip()
        alert(`Successfully exported ${sessionPhotos.value.length} photos as ZIP file`)
      } catch (error) {
        alert(`Error exporting ZIP: ${error.message}`)
      }
    }

    const exportKMZ = async () => {
      try {
        await exportPhotosAsKMZ()
        alert(`Successfully exported ${geotaggedPhotosCount.value} geotagged photos as KMZ file`)
      } catch (error) {
        alert(`Error exporting KMZ: ${error.message}`)
      }
    }

    // Load cache info when component mounts
    onMounted(() => {
      loadCacheInfo()
    })

    return {
      user,
      handleSignOut,
      isInformationModalOpen,
      showInformationModal,
      closeInformationModal,
      sessionPhotos,
      geotaggedPhotosCount,
      exportZIP,
      exportKMZ,
      cacheInfo,
      clearingCache,
      clearTilesCache,
      clearAllCaches
    }
  }
}
</script>

<style scoped>
.settings-view {
  padding: 0.75rem;
  padding-bottom: 80px;
  background: #1394b9;
  height: calc(100vh - 70px);
  color: #fcfcfc;
  max-width: 100vw;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
}

.settings-title {
  margin-bottom: 1.25rem;
  color: #fcfcfc;
  font-size: 1.3rem;
  font-weight: 600;
}

.settings-card {
  background: rgba(252, 252, 252, 0.2);
  border-radius: 16px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  border: 1px solid rgba(252, 252, 252, 0.2);
  max-width: 100%;
  box-sizing: border-box;
}

.user-info {
  margin-bottom: 1rem;
  color: #e2e8f0;
}

.user-email {
  color: #fcfcfc;
}

.sign-out-button {
  background:rgba(0, 129, 204, 1);
  border: 1px solid rgba(0, 129, 204, 1);
  border-radius: 12px;
  padding: 0.75rem;
  color: #fcfcfc;
  cursor: pointer;
  width: 100%;
  max-width: 200px;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.sign-out-button:hover {
  background: rgba(244, 67, 54, 0.3);
  transform: translateY(-1px);
}


.information-button {
  background: rgba(252, 252, 252, 0.1);
  border: 1px solid rgba(252, 252, 252, 0.3);
  border-radius: 50%;
  padding: 0.75rem;
  color: #ffffff;
  cursor: pointer;
  width: 48px;
  height: 48px;
  font-weight: 600;
  font-size: 1.2rem;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.information-button:hover {
  background: rgba(252, 252, 252, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.button-icon {
  font-size: 1.1rem;
}


.card-title {
  margin: 0 0 0.75rem 0;
  color: #fcfcfc;
  font-size: 1.1rem;
  font-weight: 600;
}

.photo-export-info {
  margin-bottom: 1rem;
  color: #e2e8f0;
}

.photo-export-info p {
  margin: 0.5rem 0;
}

.photo-export-info strong {
  color: #fcfcfc;
}

.export-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.export-button {
  background: rgba(252, 252, 252, 0.1);
  border: 1px solid rgba(252, 252, 252, 0.3);
  border-radius: 12px;
  padding: 0.75rem 0.5rem;
  color: #fcfcfc;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  min-height: 44px;
}

.export-button:hover:not(:disabled) {
  background: rgba(252, 252, 252, 0.2);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.export-button:disabled {
  background: rgba(108, 117, 125, 0.3);
  color: rgba(252, 252, 252, 0.5);
  cursor: not-allowed;
  border-color: rgba(108, 117, 125, 0.3);
}

.zip-button:hover:not(:disabled) {
  background: rgba(76, 175, 80, 0.2);
  border-color: rgba(76, 175, 80, 0.5);
}

.kmz-button:hover:not(:disabled) {
  background: rgba(255, 152, 0, 0.2);
  border-color: rgba(255, 152, 0, 0.5);
}



/* Cache Management Styles */
.cache-info {
  margin-bottom: 1rem;
  color: #e2e8f0;
}

.cache-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0;
}

.cache-list li {
  margin: 0.25rem 0;
  font-size: 0.85rem;
}

.cache-list strong {
  color: #fcfcfc;
}

.cache-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.cache-button {
  background: rgba(252, 252, 252, 0.1);
  border: 1px solid rgba(252, 252, 252, 0.3);
  border-radius: 12px;
  padding: 0.75rem 0.5rem;
  color: #fcfcfc;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.75rem;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  min-height: 44px;
  text-align: center;
  word-wrap: break-word;
  hyphens: auto;
}

.cache-button:hover:not(:disabled) {
  background: rgba(252, 252, 252, 0.2);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.cache-button:disabled {
  background: rgba(108, 117, 125, 0.3);
  color: rgba(252, 252, 252, 0.5);
  cursor: not-allowed;
  border-color: rgba(108, 117, 125, 0.3);
}

.tiles-button:hover:not(:disabled) {
  background: rgba(255, 152, 0, 0.2);
  border-color: rgba(255, 152, 0, 0.5);
}

.clear-all-button:hover:not(:disabled) {
  background: rgba(244, 67, 54, 0.2);
  border-color: rgba(244, 67, 54, 0.5);
}

.cache-description {
  font-size: 0.7rem;
  color: #cbd5e0;
  margin: 0;
  line-height: 1.2;
  text-align: center;
  padding: 0 0.25rem;
}

/* Responsive adjustments for small screens */
@media (max-width: 480px) {
  .settings-view {
    padding: 0.75rem;
  }
  
  .settings-card {
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }
  
  .cache-button,
  .export-button {
    font-size: 0.7rem;
    padding: 0.5rem 0.25rem;
    min-height: 40px;
  }
  
  .export-buttons,
  .cache-buttons {
    gap: 0.5rem;
  }
  
  .card-title {
    font-size: 1.1rem;
    margin-bottom: 0.75rem;
  }
  
  .settings-title {
    font-size: 1.3rem;
    margin-bottom: 1.5rem;
  }
}

/* Ensure no horizontal overflow */
* {
  box-sizing: border-box;
}

.settings-view * {
  max-width: 100%;
}
</style>