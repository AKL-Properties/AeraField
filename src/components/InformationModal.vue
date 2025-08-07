<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <div class="header-content">
          <i class="fas fa-circle-info header-icon"></i>
          <h3 class="modal-title">App Information</h3>
        </div>
        <button @click="closeModal" class="close-button">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <div class="info-section">
          <h4 class="info-label">App Name</h4>
          <p class="info-value">AeraField</p>
        </div>

        <div class="info-section">
          <h4 class="info-label">Description</h4>
          <p class="info-value">
            AeraField is a mobile-first, offline-ready WebGIS platform designed for real-time lot tracking, 
            geolocation-based navigation, and interactive land data visualization in the field. It allows 
            seamless access to lot attributes, supports offline tile caching, and is optimized for mobile 
            devices used in remote or low-signal conditions.
          </p>
        </div>

        <div class="info-section">
          <h4 class="info-label">Technology Stack</h4>
          <p class="info-value">
            Built with Vue.js, Leaflet.js, and Tailwind CSS. Supabase handles user authentication and 
            backend data access.
          </p>
        </div>

        <div class="info-section">
          <h4 class="info-label">Purpose</h4>
          <p class="info-value">
            Created specifically for the Aera Team to support field operations such as property validation, 
            lot identification, and on-site assessment.
          </p>
        </div>

        <div class="info-section">
          <h4 class="info-label">Access Restrictions</h4>
          <p class="info-value">
            This system is exclusively intended for use by <strong>authorized internal personnel of Aera</strong>. 
            Any unauthorized access, misuse, or distribution is strictly prohibited. Activity within the 
            platform may be logged for audit and accountability.
          </p>
        </div>

        <div class="info-section">
          <h4 class="info-label">Security</h4>
          <p class="info-value">
            User sessions are authenticated through Supabase and are protected by token-based access control. 
            All map and lot data are served securely. Sensitive data access is limited based on internal permissions.
          </p>
        </div>

        <div class="info-section">
          <h4 class="info-label">Developer</h4>
          <p class="info-value">enage.isaac@akl.com.ph</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'InformationModal',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  methods: {
    closeModal() {
      this.$emit('close')
    }
  },
  mounted() {
    document.addEventListener('keydown', this.handleKeydown)
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleKeydown)
  },
  methods: {
    closeModal() {
      this.$emit('close')
    },
    handleKeydown(event) {
      if (event.key === 'Escape' && this.isOpen) {
        this.closeModal()
      }
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 80px; /* Account for bottom navigation */
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001; /* Higher than bottom nav (1000) */
  padding: 1rem;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease-out;
}

.modal-container {
  background: #1294b9;
  border-radius: 16px;
  max-width: 90vw;
  max-height: calc(100vh - 160px); /* Account for bottom nav (80px) and padding (80px) */
  width: 100%;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s ease-out;
  border: 1px solid rgba(252, 252, 252, 0.2);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(252, 252, 252, 0.2);
  background: rgba(252, 252, 252, 0.1);
  flex-shrink: 0; /* Prevent header from shrinking */
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  color: #fcfcfc;
  font-size: 1.25rem;
}

.modal-title {
  color: #fcfcfc;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  color: #fcfcfc;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  font-size: 1.25rem;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
}

.close-button:hover {
  background: rgba(252, 252, 252, 0.1);
  transform: scale(1.05);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1; /* Take remaining space */
  min-height: 0; /* Allow flex item to shrink below content size */
}

.info-section {
  margin-bottom: 1.5rem;
}

.info-section:last-child {
  margin-bottom: 0;
}

.info-label {
  color: #fcfcfc;
  font-weight: 600;
  font-size: 0.95rem;
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  color: #e2e8f0;
  font-size: 0.9rem;
  line-height: 1.6;
  margin: 0;
}

.info-value strong {
  color: #fcfcfc;
  font-weight: 600;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 0.5rem;
  }
  
  .modal-container {
    max-height: calc(100vh - 120px); /* Account for bottom nav (80px) and smaller padding (40px) */
    margin: 0;
  }
  
  .modal-header {
    padding: 1rem;
  }
  
  .modal-body {
    padding: 1rem;
  }
  
  .info-label {
    font-size: 0.9rem;
  }
  
  .info-value {
    font-size: 0.85rem;
  }
}

/* iOS safe area support */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .modal-overlay {
    bottom: calc(80px + env(safe-area-inset-bottom)); /* Bottom nav + iOS safe area */
  }
  
  .modal-body {
    padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
  }
}
</style>