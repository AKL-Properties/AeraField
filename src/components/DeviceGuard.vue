<template>
  <div v-if="!isValidDevice" class="device-restriction">
    <div class="restriction-card">
      <div class="logo-circle">
          <img src="/logo.png" alt="AeraField Logo" style="width:100px; height:60px;" />
        </div>
      <p class="message">
       This app is only available on mobile and tablet devices. Please switch to a supported device.
      </p>
      <div class="device-icons">

      </div>
    </div>
  </div>
  
  <slot v-else />
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'

export default {
  name: 'DeviceGuard',
  setup() {
    const isValidDevice = ref(true)

    const checkScreenSize = () => {
      const screenWidth = window.innerWidth
      isValidDevice.value = screenWidth <= 1024
    }

    onMounted(() => {
      checkScreenSize()
      window.addEventListener('resize', checkScreenSize)
    })

    onUnmounted(() => {
      window.removeEventListener('resize', checkScreenSize)
    })

    return {
      isValidDevice
    }
  }
}
</script>

<style scoped>
.device-restriction {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  background: #1294b9;
  color: #fcfcfc;
  text-align: center;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.restriction-card {
  max-width: 500px;
  padding: 3rem;
  background: rgba(252, 252, 252, 0.2);
  border-radius: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(252, 252, 252, 0.2);
  box-shadow: 0 20px 40px rgba(18, 148, 185, 0.3);
}

.icon-circle {
  width: 80px;
  height: 80px;
  margin: 0 auto 2rem;
  background: #1294b9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
}

.title {
  font-size: 1.8rem;
  margin-bottom: 1rem;
  font-weight: 600;
  color: #fcfcfc;
}

.message {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #e0e0e0;
  margin-bottom: 1.5rem;
}

.device-icons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  font-size: 2rem;
}
</style>