<template>
  <div class="home-view">
    <h1 class="welcome-title">Welcome to AeraField</h1>
    <p class="subtitle">Field navigation and geospatial data interaction platform</p>
    
    <div class="quick-actions-card">
      <h3 class="card-title">Quick Actions</h3>
      <button @click="$emit('navigate', 'map')" class="action-button primary">
        🗺️ Open Map View
      </button>
    </div>

    <button @click="handleSignOut" class="sign-out-button">
      Sign Out
    </button>
  </div>
</template>

<script>
import { inject } from 'vue'

export default {
  name: 'HomeView',
  emits: ['navigate'],
  setup() {
    const { signOut } = inject('auth')

    const handleSignOut = async () => {
      await signOut()
    }

    return {
      handleSignOut
    }
  }
}
</script>

<style scoped>
.home-view {
  padding: 2rem 1rem;
  padding-bottom: 100px;
  background: #1294b9;
  min-height: 100vh;
  color: #fcfcfc;
}

.welcome-title {
  font-size: 2rem;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #1394b9, #26a6c4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: #64748b;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.quick-actions-card {
  background: rgba(252, 252, 252, 0.2);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(252, 252, 252, 0.2);
}

.card-title {
  margin-bottom: 1rem;
  color: #fcfcfc;
  font-weight: 600;
}

.action-button {
  width: 100%;
  padding: 1rem;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 0.5rem;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.action-button.primary {
  background: linear-gradient(135deg, #1394b9, #26a6c4);
  color: #fcfcfc;
}

.action-button.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(19, 148, 185, 0.3);
}

.action-button.secondary {
  background: rgba(252, 252, 252, 0.2);
  border: 1px solid rgba(252, 252, 252, 0.2);
  color: #fcfcfc;
}

.action-button.secondary:hover {
  background: rgba(252, 252, 252, 0.3);
  transform: translateY(-1px);
}

.sign-out-button {
  background: rgba(244, 67, 54, 0.2);
  border: 1px solid rgba(244, 67, 54, 0.5);
  border-radius: 12px;
  padding: 1rem;
  color: #f44336;
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
</style>