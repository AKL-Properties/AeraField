import { createApp, h } from 'vue'
import App from './App.vue'
import './styles/main.css'

import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faLocationDot, faPalette, faTimes, faHome, faEye, faEyeSlash, faInfo } from '@fortawesome/free-solid-svg-icons'

library.add(faLocationDot, faPalette, faTimes, faHome, faEye, faEyeSlash, faInfo)

const app = createApp({
  render: () => h(App)
})

app.component('font-awesome-icon', FontAwesomeIcon)

app.config.errorHandler = (error, instance, info) => {
  console.error('Vue Error:', error, info)
}

// Register service worker for offline functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration)
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              console.log('New version available. Please refresh.')
            }
          })
        })
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError)
      })
  })
}

app.mount('#app')