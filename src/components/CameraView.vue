<template>
  <div class="camera-view">
    <div class="camera-header">
      <h2>Camera</h2>
      <div class="photo-count">
        Photos: {{ sessionPhotos.length }}
      </div>
    </div>

    <!-- Camera Preview and Controls -->
    <div class="camera-container" v-if="showCamera">
      <div class="camera-preview">
        <video 
          ref="videoElement"
          autoplay 
          playsinline 
          muted
          class="video-preview"
        ></video>
        <canvas 
          ref="canvasElement"
          class="capture-canvas"
          style="display: none;"
        ></canvas>
      </div>

      <div class="camera-actions">
        <button 
          @click="switchCamera" 
          :disabled="!canSwitchCamera"
          class="switch-camera-btn"
        >
          <font-awesome-icon :icon="faSync" />
          {{ currentFacingMode === 'environment' ? 'Front' : 'Back' }}
        </button>

        <button 
          @click="capturePhoto" 
          :disabled="isCapturing"
          class="capture-btn-large"
        >
          <div class="capture-circle">
            <font-awesome-icon 
              :icon="faCamera" 
              :class="{ 'capturing': isCapturing }"
            />
          </div>
        </button>

        <button 
          @click="closeCameraView"
          class="close-camera-btn"
        >
          <font-awesome-icon :icon="faTimes" />
          Close
        </button>
      </div>
    </div>

    <!-- Main Controls (when camera is closed) -->
    <div class="main-controls" v-if="!showCamera">
      <button 
        @click="openCameraView" 
        :disabled="isCapturing"
        class="open-camera-btn"
      >
        <font-awesome-icon :icon="faCamera" />
        Open Camera
      </button>

      <button 
        @click="exportPhotos" 
        :disabled="sessionPhotos.length === 0"
        class="export-btn"
      >
        <font-awesome-icon :icon="faDownload" />
        Export ZIP ({{ sessionPhotos.length }})
      </button>

      <button 
        @click="exportPhotosAsKMZFile" 
        :disabled="sessionPhotos.filter(p => p.location).length === 0"
        class="export-kmz-btn"
      >
        <font-awesome-icon :icon="faDownload" />
        Export KMZ ({{ sessionPhotos.filter(p => p.location).length }})
      </button>

      <button 
        @click="clearPhotos" 
        :disabled="sessionPhotos.length === 0"
        class="clear-btn"
      >
        <font-awesome-icon :icon="faTrash" />
        Clear All
      </button>
    </div>

    <!-- Photos Grid -->
    <div class="photos-grid" v-if="sessionPhotos.length > 0 && !showCamera">
      <div 
        v-for="(photo, index) in sessionPhotos" 
        :key="photo.id"
        class="photo-item"
      >
        <img :src="photo.thumbnail" :alt="`Photo ${index + 1}`" />
        <div class="photo-info">
          <div class="photo-timestamp">{{ formatTimestamp(photo.timestamp) }}</div>
          <div class="photo-location" v-if="photo.location">
            {{ photo.location.latitude.toFixed(6) }}, {{ photo.location.longitude.toFixed(6) }}
          </div>
          <button @click="downloadSinglePhoto(photo)" class="download-single">
            <font-awesome-icon :icon="faDownload" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div class="empty-state" v-if="sessionPhotos.length === 0 && !showCamera">
      <font-awesome-icon :icon="faCamera" class="empty-icon" />
      <p>No photos captured yet</p>
      <p class="empty-subtitle">Tap "Open Camera" to start capturing geotagged images</p>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCamera, faDownload, faTrash, faSync, faTimes } from '@fortawesome/free-solid-svg-icons'
import piexif from 'piexifjs'
import JSZip from 'jszip'
import { useSessionPhotos } from '../composables/useSessionPhotos'

export default {
  name: 'CameraView',
  components: {
    FontAwesomeIcon
  },
  setup() {
    const videoElement = ref(null)
    const canvasElement = ref(null)
    const isCapturing = ref(false)
    const showCamera = ref(false)
    const currentStream = ref(null)
    const currentFacingMode = ref('environment') // 'environment' = back, 'user' = front
    const canSwitchCamera = ref(false)
    const capturedPhotos = reactive([])
    
    // Session photo management
    const { 
      sessionPhotos, 
      isSessionActive, 
      addPhotoToSession, 
      exportPhotosAsZip, 
      exportPhotosAsKMZ,
      startSession,
      endSession
    } = useSessionPhotos()

    // Ensure session is active for camera usage
    if (!isSessionActive.value) {
      startSession()
    }

    // Check if device has multiple cameras
    const checkCameraCapabilities = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        canSwitchCamera.value = videoDevices.length > 1
      } catch (error) {
        console.error('Error checking camera capabilities:', error)
        canSwitchCamera.value = false
      }
    }

    // Start camera stream
    const startCameraStream = async (facingMode = 'environment') => {
      try {
        // Stop existing stream if any
        if (currentStream.value) {
          currentStream.value.getTracks().forEach(track => track.stop())
        }

        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        currentStream.value = stream
        
        if (videoElement.value) {
          videoElement.value.srcObject = stream
          await videoElement.value.play()
        }

        currentFacingMode.value = facingMode
        return true
      } catch (error) {
        console.error('Error starting camera stream:', error)
        throw error
      }
    }

    // Stop camera stream
    const stopCameraStream = () => {
      if (currentStream.value) {
        currentStream.value.getTracks().forEach(track => track.stop())
        currentStream.value = null
      }
      if (videoElement.value) {
        videoElement.value.srcObject = null
      }
    }

    // Open camera view
    const openCameraView = async () => {
      try {
        showCamera.value = true
        await checkCameraCapabilities()
        await startCameraStream(currentFacingMode.value)
      } catch (error) {
        console.error('Error opening camera:', error)
        alert('Unable to access camera. Please check permissions and try again.')
        showCamera.value = false
      }
    }

    // Close camera view
    const closeCameraView = () => {
      stopCameraStream()
      showCamera.value = false
    }

    // Switch between front and back camera
    const switchCamera = async () => {
      if (!canSwitchCamera.value) return
      
      const newFacingMode = currentFacingMode.value === 'environment' ? 'user' : 'environment'
      
      try {
        await startCameraStream(newFacingMode)
      } catch (error) {
        console.error('Error switching camera:', error)
        alert('Unable to switch camera. Using current camera.')
      }
    }

    // Capture photo from video stream
    const capturePhoto = async () => {
      if (!videoElement.value || !canvasElement.value) return
      
      try {
        isCapturing.value = true
        
        const video = videoElement.value
        const canvas = canvasElement.value
        const ctx = canvas.getContext('2d')
        
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // Convert canvas to blob
        const blob = await new Promise(resolve => {
          canvas.toBlob(resolve, 'image/jpeg', 0.9)
        })
        
        // Convert blob to data URL
        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            let imageData = e.target.result
            const location = await getCurrentLocation()
            
            if (location) {
              imageData = await addGPSExifData(imageData, location)
            }

            const photo = {
              id: Date.now() + Math.random(),
              data: imageData,
              thumbnail: await createThumbnail(imageData),
              filename: `photo_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`,
              timestamp: new Date(),
              location: location,
              originalSize: blob.size
            }

            // Add to both local array and session storage
            capturedPhotos.push(photo)
            addPhotoToSession(photo)
            
            // Flash effect for feedback
            flashEffect()
            
          } catch (error) {
            console.error('Error processing photo:', error)
            alert('Error processing photo. Photo may be saved without GPS data.')
          } finally {
            isCapturing.value = false
          }
        }
        
        reader.readAsDataURL(blob)
        
      } catch (error) {
        console.error('Error capturing photo:', error)
        alert('Error capturing photo. Please try again.')
        isCapturing.value = false
      }
    }

    // Flash effect for photo capture feedback
    const flashEffect = () => {
      const flash = document.createElement('div')
      flash.style.position = 'fixed'
      flash.style.top = '0'
      flash.style.left = '0'
      flash.style.width = '100vw'
      flash.style.height = '100vh'
      flash.style.backgroundColor = 'white'
      flash.style.opacity = '0.8'
      flash.style.zIndex = '9999'
      flash.style.pointerEvents = 'none'
      
      document.body.appendChild(flash)
      
      setTimeout(() => {
        document.body.removeChild(flash)
      }, 150)
    }

    // Cleanup on unmount
    onUnmounted(() => {
      stopCameraStream()
    })

    const getCurrentLocation = () => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          console.warn('Geolocation not supported')
          resolve(null)
          return
        }

        // Check if running on HTTPS (required for Safari and other browsers)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
          console.warn('Geolocation requires HTTPS connection')
          resolve(null)
          return
        }

        // For Safari iOS, we need to handle permissions differently
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

        const options = {
          enableHighAccuracy: true,
          timeout: isIOS ? 15000 : 10000, // iOS needs more time
          maximumAge: isIOS ? 300000 : 60000 // iOS can use slightly older positions
        }

        // For Safari iOS, try multiple attempts with different options
        if (isSafari && isIOS) {
          let attempts = 0
          const maxAttempts = 2 // Fewer attempts for camera to avoid delays
          
          const tryGetPosition = () => {
            attempts++
            const currentOptions = {
              ...options,
              enableHighAccuracy: attempts === 1, // First try with high accuracy
              timeout: attempts === 1 ? 10000 : 5000, // Reduce timeout on retries
              maximumAge: attempts === 1 ? 300000 : 0 // Fresh position on retries
            }

            navigator.geolocation.getCurrentPosition(
              (position) => {
                resolve({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  timestamp: position.timestamp
                })
              },
              (error) => {
                console.warn(`Geolocation attempt ${attempts} failed:`, error)
                
                if (attempts < maxAttempts) {
                  // Try again with different settings
                  setTimeout(tryGetPosition, 500)
                } else {
                  // All attempts failed, resolve with null (don't block photo capture)
                  console.warn('GPS location unavailable after all attempts:', error)
                  resolve(null)
                }
              },
              currentOptions
            )
          }
          
          tryGetPosition()
        } else {
          // Standard implementation for other browsers
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
              })
            },
            (error) => {
              console.warn('GPS location unavailable:', error)
              resolve(null) // Don't block photo capture if GPS fails
            },
            options
          )
        }
      })
    }


    const addGPSExifData = async (imageDataURL, location) => {
      try {
        const exifDict = piexif.load(imageDataURL)
        
        const lat = location.latitude
        const lng = location.longitude
        
        const latDeg = Math.floor(Math.abs(lat))
        const latMin = Math.floor((Math.abs(lat) - latDeg) * 60)
        const latSec = Math.round(((Math.abs(lat) - latDeg) * 60 - latMin) * 60 * 100)
        
        const lngDeg = Math.floor(Math.abs(lng))
        const lngMin = Math.floor((Math.abs(lng) - lngDeg) * 60)
        const lngSec = Math.round(((Math.abs(lng) - lngDeg) * 60 - lngMin) * 60 * 100)
        
        exifDict.GPS = {
          [piexif.GPSIFD.GPSLatitudeRef]: lat >= 0 ? 'N' : 'S',
          [piexif.GPSIFD.GPSLatitude]: [[latDeg, 1], [latMin, 1], [latSec, 100]],
          [piexif.GPSIFD.GPSLongitudeRef]: lng >= 0 ? 'E' : 'W',
          [piexif.GPSIFD.GPSLongitude]: [[lngDeg, 1], [lngMin, 1], [lngSec, 100]],
          [piexif.GPSIFD.GPSTimeStamp]: getGPSTimeStamp(),
          [piexif.GPSIFD.GPSDateStamp]: getGPSDateStamp()
        }
        
        const exifBytes = piexif.dump(exifDict)
        return piexif.insert(exifBytes, imageDataURL)
        
      } catch (error) {
        console.error('Error adding GPS EXIF data:', error)
        return imageDataURL
      }
    }

    const getGPSTimeStamp = () => {
      const now = new Date()
      return [
        [now.getUTCHours(), 1],
        [now.getUTCMinutes(), 1], 
        [now.getUTCSeconds(), 1]
      ]
    }

    const getGPSDateStamp = () => {
      const now = new Date()
      const year = now.getUTCFullYear()
      const month = String(now.getUTCMonth() + 1).padStart(2, '0')
      const day = String(now.getUTCDate()).padStart(2, '0')
      return `${year}:${month}:${day}`
    }

    const createThumbnail = (imageDataURL) => {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()
        
        img.onload = () => {
          const maxSize = 150
          let { width, height } = img
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width
              width = maxSize
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height
              height = maxSize
            }
          }
          
          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.8))
        }
        
        img.src = imageDataURL
      })
    }

    const downloadSinglePhoto = (photo) => {
      const link = document.createElement('a')
      link.href = photo.data
      link.download = photo.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }

    const exportPhotos = async () => {
      if (sessionPhotos.value.length === 0) return

      try {
        await exportPhotosAsZip()
        alert(`Successfully exported ${sessionPhotos.value.length} photos as ZIP`)
      } catch (error) {
        console.error('Error exporting photos:', error)
        alert(`Error exporting photos: ${error.message}`)
      }
    }

    const exportPhotosAsKMZFile = async () => {
      if (sessionPhotos.value.length === 0) return

      try {
        await exportPhotosAsKMZ()
        const geotaggedCount = sessionPhotos.value.filter(p => p.location).length
        alert(`Successfully exported ${geotaggedCount} geotagged photos as KMZ`)
      } catch (error) {
        console.error('Error exporting photos as KMZ:', error)
        alert(`Error exporting KMZ: ${error.message}`)
      }
    }

    const clearPhotos = () => {
      if (confirm('Are you sure you want to clear all photos? This action cannot be undone.')) {
        // Clear local photos array
        capturedPhotos.splice(0)
        // End session and clear all session storage
        endSession()
        // Start a new session
        startSession()
      }
    }

    const formatTimestamp = (timestamp) => {
      return new Date(timestamp).toLocaleString()
    }

    return {
      videoElement,
      canvasElement,
      isCapturing,
      showCamera,
      currentFacingMode,
      canSwitchCamera,
      capturedPhotos,
      sessionPhotos,
      openCameraView,
      closeCameraView,
      switchCamera,
      capturePhoto,
      downloadSinglePhoto,
      exportPhotos,
      exportPhotosAsKMZFile,
      clearPhotos,
      formatTimestamp,
      faCamera,
      faDownload,
      faTrash,
      faSync,
      faTimes
    }
  }
}
</script>

<style scoped>
.camera-view {
  padding: 1rem;
  padding-bottom: 100px;
  min-height: 100vh;
  background: #1294b9;
  color: white;
}

.camera-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.camera-header h2 {
  margin: 0;
  color: white;
  font-size: 1.5rem;
}

.photo-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
}

/* Camera Container */
.camera-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #000;
  z-index: 1001;
  display: flex;
  flex-direction: column;
}

.camera-preview {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.capture-canvas {
  position: absolute;
  top: 0;
  left: 0;
}

/* Camera Actions */
.camera-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
  padding: 2rem 1rem;
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.switch-camera-btn, .close-camera-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.switch-camera-btn:hover, .close-camera-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.switch-camera-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.capture-btn-large {
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.capture-btn-large:hover {
  background: rgba(255, 255, 255, 1);
  transform: scale(1.1);
}

.capture-btn-large:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: scale(1);
}

.capture-circle {
  width: 60px;
  height: 60px;
  background: #00bcd4;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
}

.capture-circle .capturing {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* Main Controls */
.main-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.open-camera-btn, .export-btn, .export-kmz-btn, .clear-btn {
  padding: 1rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.open-camera-btn {
  background: #00bcd4;
  color: white;
  transform: scale(1);
}

.open-camera-btn:hover {
  background: #00acc1;
  transform: scale(1.02);
}

.open-camera-btn:disabled {
  background: #666;
  cursor: not-allowed;
  transform: scale(1);
}

.export-btn {
  background: #4caf50;
  color: white;
}

.export-btn:hover {
  background: #45a049;
}

.export-btn:disabled {
  background: #666;
  cursor: not-allowed;
}

.export-kmz-btn {
  background: #ff9800;
  color: white;
}

.export-kmz-btn:hover {
  background: #f57c00;
}

.export-kmz-btn:disabled {
  background: #666;
  cursor: not-allowed;
}

.clear-btn {
  background: #f44336;
  color: white;
}

.clear-btn:hover {
  background: #da190b;
}

.clear-btn:disabled {
  background: #666;
  cursor: not-allowed;
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.photo-item {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.photo-item img {
  width: 100%;
  height: 150px;
  object-fit: cover;
}

.photo-info {
  padding: 1rem;
}

.photo-timestamp {
  font-size: 0.9rem;
  color: #e0e0e0;
  margin-bottom: 0.5rem;
}

.photo-location {
  font-size: 0.8rem;
  color: #00bcd4;
  margin-bottom: 1rem;
  font-family: monospace;
}

.download-single {
  background: #00bcd4;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
}

.download-single:hover {
  background: #00acc1;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: rgba(255, 255, 255, 0.7);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.3);
}

.empty-state p {
  margin: 0.5rem 0;
  font-size: 1.1rem;
}

.empty-subtitle {
  font-size: 0.9rem !important;
  color: rgba(255, 255, 255, 0.5) !important;
}
</style>