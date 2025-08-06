<template>
  <DeviceGuard>
    <InitializationPage v-if="showInitialization" />
    
    <div v-else-if="isLoading" class="loading-screen">
      <div class="loading-content">
        <div class="spinner"></div>
        <span>Loading AeraField...</span>
      </div>
    </div>
    
    <Login v-else-if="!user" />
    
    <div v-else class="app-container">
      <component :is="currentView" :map-ref="mapInstance" />
      
      <BottomNav
        :active-tab="activeTab"
        @tab-change="handleTabChange"
      />
    </div>
  </DeviceGuard>
</template>

<script>
import { ref, computed, provide, onMounted } from 'vue'
import DeviceGuard from './components/DeviceGuard.vue'
import InitializationPage from './components/InitializationPage.vue'
import Login from './components/Login.vue'
import BottomNav from './components/BottomNav.vue'
import MapView from './components/MapView.vue'
import LayerPanel from './components/LayerPanel.vue'
import SettingsView from './components/SettingsView.vue'
import CameraView from './components/CameraView.vue'
import { useAuth } from './composables/useAuth'

export default {
  name: 'App',
  components: {
    DeviceGuard,
    InitializationPage,
    Login,
    BottomNav,
    MapView,
    LayerPanel,
    SettingsView,
    CameraView
  },
  setup() {
    const { user, loading: isLoading, signOut } = useAuth()
    const activeTab = ref('map')
    const mapInstance = ref(null)
    const showInitialization = ref(true)

    onMounted(() => {
      setTimeout(() => {
        showInitialization.value = false
      }, 5000)
    })

    const currentView = computed(() => {
      switch (activeTab.value) {
        case 'map':
          return MapView
        case 'layers':
          return LayerPanel
        case 'camera':
          return CameraView
        case 'settings':
          return SettingsView
        default:
          return MapView
      }
    })


    const handleTabChange = (tab) => {
      activeTab.value = tab
    }

    provide('auth', { user, signOut })
    provide('mapInstance', mapInstance)

    return {
      user,
      isLoading,
      activeTab,
      mapInstance,
      showInitialization,
      currentView,
      handleTabChange
    }
  }
}
</script>

<style scoped>
.app-container {
  height: 100vh;
  background: #1394b9;
}

.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #1394b9;
  color: #fcfcfc;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(252, 252, 252, 0.3);
  border-top: 3px solid #fcfcfc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>