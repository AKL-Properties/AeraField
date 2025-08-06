<template>
  <div class="camera-view">
    <div class="camera-header">
      <h2>Camera</h2>
      <div class="photo-count">
        Photos: {{ capturedPhotos.length }}
      </div>
    </div>

    <div class="camera-controls">
      <button 
        @click="capturePhoto" 
        :disabled="isCapturing"
        class="capture-btn"
      >
        <font-awesome-icon 
          :icon="faCamera" 
          :class="{ 'capturing': isCapturing }"
        />
        {{ isCapturing ? 'Capturing...' : 'Take Photo' }}
      </button>

      <button 
        @click="exportPhotos" 
        :disabled="capturedPhotos.length === 0"
        class="export-btn"
      >
        <font-awesome-icon :icon="faDownload" />
        Export Photos ({{ capturedPhotos.length }})
      </button>

      <button 
        @click="clearPhotos" 
        :disabled="capturedPhotos.length === 0"
        class="clear-btn"
      >
        <font-awesome-icon :icon="faTrash" />
        Clear All
      </button>
    </div>

    <div class="photos-grid" v-if="capturedPhotos.length > 0">
      <div 
        v-for="(photo, index) in capturedPhotos" 
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

    <div class="empty-state" v-else>
      <font-awesome-icon :icon="faCamera" class="empty-icon" />
      <p>No photos captured yet</p>
      <p class="empty-subtitle">Tap "Take Photo" to start capturing geotagged images</p>
    </div>

    <input 
      ref="fileInput"
      type="file" 
      accept="image/*" 
      capture="environment"
      @change="handleFileSelect"
      style="display: none;"
    >
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCamera, faDownload, faTrash } from '@fortawesome/free-solid-svg-icons'
import piexif from 'piexifjs'
import JSZip from 'jszip'

export default {
  name: 'CameraView',
  components: {
    FontAwesomeIcon
  },
  setup() {
    const fileInput = ref(null)
    const isCapturing = ref(false)
    const capturedPhotos = reactive([])

    const capturePhoto = async () => {
      try {
        isCapturing.value = true
        
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          await requestCameraPermission()
        }
        
        fileInput.value.click()
      } catch (error) {
        console.error('Error accessing camera:', error)
        alert('Unable to access camera. Please check permissions.')
      } finally {
        isCapturing.value = false
      }
    }

    const requestCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        })
        stream.getTracks().forEach(track => track.stop())
        return true
      } catch (error) {
        console.error('Camera permission denied:', error)
        throw error
      }
    }

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

    const handleFileSelect = async (event) => {
      const file = event.target.files[0]
      if (!file) return

      try {
        isCapturing.value = true
        
        const location = await getCurrentLocation()
        
        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            let imageData = e.target.result
            
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
              originalSize: file.size
            }

            capturedPhotos.push(photo)
            
          } catch (error) {
            console.error('Error processing photo:', error)
            alert('Error processing photo. Photo saved without GPS data.')
          } finally {
            isCapturing.value = false
            event.target.value = ''
          }
        }
        
        reader.readAsDataURL(file)
        
      } catch (error) {
        console.error('Error handling file:', error)
        isCapturing.value = false
        event.target.value = ''
      }
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
      if (capturedPhotos.length === 0) return

      try {
        const zip = new JSZip()
        
        for (const photo of capturedPhotos) {
          const base64Data = photo.data.split(',')[1]
          zip.file(photo.filename, base64Data, { base64: true })
        }
        
        const content = await zip.generateAsync({ type: 'blob' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(content)
        link.download = `aerafield_photos_${new Date().toISOString().split('T')[0]}.zip`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
      } catch (error) {
        console.error('Error exporting photos:', error)
        alert('Error exporting photos. Please try again.')
      }
    }

    const clearPhotos = () => {
      if (confirm('Are you sure you want to clear all photos? This action cannot be undone.')) {
        capturedPhotos.splice(0)
      }
    }

    const formatTimestamp = (timestamp) => {
      return new Date(timestamp).toLocaleString()
    }

    return {
      fileInput,
      isCapturing,
      capturedPhotos,
      capturePhoto,
      handleFileSelect,
      downloadSinglePhoto,
      exportPhotos,
      clearPhotos,
      formatTimestamp,
      faCamera,
      faDownload,
      faTrash
    }
  }
}
</script>

<style scoped>
.camera-view {
  padding: 1rem;
  padding-bottom: 100px;
  min-height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
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

.camera-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.capture-btn, .export-btn, .clear-btn {
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

.capture-btn {
  background: #00bcd4;
  color: white;
  transform: scale(1);
}

.capture-btn:hover {
  background: #00acc1;
  transform: scale(1.02);
}

.capture-btn:disabled {
  background: #666;
  cursor: not-allowed;
  transform: scale(1);
}

.capture-btn .capturing {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
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