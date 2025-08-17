<template>
  <div class="bottom-nav">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      @click="handleTabClick(tab.id)"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
      :class="['nav-button', { active: activeTab === tab.id }]"
    >
      <font-awesome-icon 
        :icon="tab.icon"
        :class="['nav-icon', { active: activeTab === tab.id }]"
      />
      <span 
        :class="['nav-label', { active: activeTab === tab.id }]"
      >
        {{ tab.label }}
      </span>
    </button>
  </div>
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faMap, faCog, faCamera, faLayerGroup } from '@fortawesome/free-solid-svg-icons'

export default {
  name: 'BottomNav',
  components: {
    FontAwesomeIcon
  },
  props: {
    activeTab: {
      type: String,
      default: 'map'
    }
  },
  emits: ['tab-change'],
  setup(props, { emit }) {
    const tabs = [
      { id: 'map', label: 'Map', icon: faMap },
      { id: 'layers', label: 'Layers', icon: faLayerGroup },
      { id: 'camera', label: 'Camera', icon: faCamera },
      { id: 'settings', label: 'Settings', icon: faCog }
    ]

    const handleTabClick = (tabId) => {
      emit('tab-change', tabId)
    }

    const handleTouchStart = (event) => {
      event.target.style.transform = 'translateY(1px) scale(0.95)'
    }

    const handleTouchEnd = (event) => {
      const isActive = event.target.closest('.nav-button').classList.contains('active')
      event.target.style.transform = isActive ? 'translateY(-2px)' : 'translateY(0)'
    }

    return {
      tabs,
      handleTabClick,
      handleTouchStart,
      handleTouchEnd
    }
  }
}
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: rgba(18, 148, 185, 0.95);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(252, 252, 252, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 1rem;
  z-index: 1000;
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.3);
}

.nav-button {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 12px;
  transition: all 0.3s ease;
  transform: translateY(0);
  min-width: 50px;
}

.nav-button.active {
  color: #ffffff;
  transform: translateY(-2px);
}

.nav-button:hover {
  color: #ffffff;
}

.nav-icon {
  font-size: 1.2rem;
  transition: filter 0.3s ease;
}

.nav-icon.active {
  filter: drop-shadow(0 0 8px #ffffff);
}

.nav-label {
  font-size: 0.65rem;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: font-weight 0.3s ease;
}

.nav-label.active {
  font-weight: 600;
}
</style>