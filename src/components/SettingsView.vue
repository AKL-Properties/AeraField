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

    <div class="settings-card info-card">
      <button @click="showInformationModal" class="information-button">
        <i class="fas fa-circle-info button-icon"></i>
        Information
      </button>
    </div>

    <InformationModal 
      :isOpen="isInformationModalOpen" 
      @close="closeInformationModal" 
    />
  </div>
</template>

<script>
import { inject, ref, computed } from 'vue'
import InformationModal from './InformationModal.vue'
import { useSessionPhotos } from '../composables/useSessionPhotos'

export default {
  name: 'SettingsView',
  components: {
    InformationModal
  },
  setup() {
    const { user, signOut } = inject('auth')
    const isInformationModalOpen = ref(false)
    
    // Session photo management
    const { sessionPhotos, exportPhotosAsZip, exportPhotosAsKMZ } = useSessionPhotos()
    
    const geotaggedPhotosCount = computed(() => {
      return sessionPhotos.value.filter(photo => photo.location).length
    })

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

    return {
      user,
      handleSignOut,
      isInformationModalOpen,
      showInformationModal,
      closeInformationModal,
      sessionPhotos,
      geotaggedPhotosCount,
      exportZIP,
      exportKMZ
    }
  }
}
</script>

<style scoped>
.settings-view {
  padding: 2rem 1rem;
  padding-bottom: 100px;
  background: #1394b9;
  min-height: 100vh;
  color: #fcfcfc;
}

.settings-title {
  margin-bottom: 2rem;
  color: #fcfcfc;
  font-size: 1.5rem;
  font-weight: 600;
}

.settings-card {
  background: rgba(252, 252, 252, 0.2);
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid rgba(252, 252, 252, 0.2);
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
  padding: 1rem;
  color: #fcfcfc;
  cursor: pointer;
  width: 100%;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.sign-out-button:hover {
  background: rgba(244, 67, 54, 0.3);
  transform: translateY(-1px);
}

.info-card {
  margin-top: 1rem;
}

.information-button {
  background: rgb(203, 179, 60, 0.986);
  border: 1px solid rgba(252, 252, 252, 0.3);
  border-radius: 12px;
  padding: 1rem;
  color: #fcfcfc;
  cursor: pointer;
  width: 100%;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.information-button:hover {
  background: rgba(252, 252, 252, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.button-icon {
  font-size: 1.1rem;
}

.photo-export-card {
  margin-bottom: 1rem;
}

.card-title {
  margin: 0 0 1rem 0;
  color: #fcfcfc;
  font-size: 1.2rem;
  font-weight: 600;
}

.photo-export-info {
  margin-bottom: 1.5rem;
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
  gap: 1rem;
}

.export-button {
  background: rgba(252, 252, 252, 0.1);
  border: 1px solid rgba(252, 252, 252, 0.3);
  border-radius: 12px;
  padding: 1rem;
  color: #fcfcfc;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
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
</style>