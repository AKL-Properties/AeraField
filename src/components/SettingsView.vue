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
  </div>
</template>

<script>
import { inject } from 'vue'

export default {
  name: 'SettingsView',
  setup() {
    const { user, signOut } = inject('auth')

    const handleSignOut = async () => {
      await signOut()
    }

    return {
      user,
      handleSignOut
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