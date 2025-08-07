import { ref, reactive, readonly, watchEffect } from 'vue'
import JSZip from 'jszip'

// Session-scoped photo storage
const sessionPhotos = ref([])
const isSessionActive = ref(false)

export function useSessionPhotos() {
  const SESSION_STORAGE_KEY = 'aerafield_session_photos'
  const SESSION_ACTIVE_KEY = 'aerafield_session_active'

  // Initialize session from storage
  const initializeSession = () => {
    try {
      const storedPhotos = sessionStorage.getItem(SESSION_STORAGE_KEY)
      const sessionActive = sessionStorage.getItem(SESSION_ACTIVE_KEY)
      
      if (storedPhotos && sessionActive === 'true') {
        const photos = JSON.parse(storedPhotos)
        sessionPhotos.value = photos || []
        isSessionActive.value = true
      } else {
        sessionPhotos.value = []
        isSessionActive.value = false
      }
    } catch (error) {
      console.error('Error loading session photos:', error)
      sessionPhotos.value = []
      isSessionActive.value = false
    }
  }

  // Start new session
  const startSession = () => {
    sessionPhotos.value = []
    isSessionActive.value = true
    sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true')
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
  }

  // End session and clear all data
  const endSession = () => {
    sessionPhotos.value = []
    isSessionActive.value = false
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
    sessionStorage.removeItem(SESSION_ACTIVE_KEY)
  }

  // Add photo to session
  const addPhotoToSession = (photoData) => {
    if (!isSessionActive.value) return

    const sessionPhoto = {
      id: Date.now() + Math.random(),
      data: photoData.data,
      thumbnail: photoData.thumbnail,
      filename: photoData.filename,
      timestamp: photoData.timestamp,
      location: photoData.location,
      originalSize: photoData.originalSize
    }

    sessionPhotos.value.push(sessionPhoto)
    
    // Persist to session storage
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionPhotos.value))
    } catch (error) {
      console.error('Error saving photo to session:', error)
    }

    return sessionPhoto
  }

  // Remove photo from session
  const removePhotoFromSession = (photoId) => {
    const index = sessionPhotos.value.findIndex(photo => photo.id === photoId)
    if (index !== -1) {
      sessionPhotos.value.splice(index, 1)
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionPhotos.value))
      } catch (error) {
        console.error('Error removing photo from session:', error)
      }
    }
  }

  // Export all session photos as ZIP
  const exportPhotosAsZip = async () => {
    if (sessionPhotos.value.length === 0) {
      throw new Error('No photos to export')
    }

    try {
      const zip = new JSZip()
      
      for (const photo of sessionPhotos.value) {
        const base64Data = photo.data.split(',')[1]
        zip.file(photo.filename, base64Data, { base64: true })
      }
      
      const content = await zip.generateAsync({ type: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(content)
      link.download = `aerafield_session_photos_${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      return true
    } catch (error) {
      console.error('Error exporting photos as ZIP:', error)
      throw error
    }
  }

  // Create KML content for photos
  const createKMLContent = () => {
    const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>AeraField Session Photos</name>
    <description>Geotagged photos captured during this session</description>
    <Style id="photo-style">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pal4/icon57.png</href>
        </Icon>
        <scale>1.2</scale>
      </IconStyle>
    </Style>`

    const placemarks = sessionPhotos.value
      .filter(photo => photo.location) // Only include photos with location
      .map(photo => {
        const timestamp = new Date(photo.timestamp).toISOString()
        return `
    <Placemark>
      <name>${photo.filename}</name>
      <description><![CDATA[
        <b>Captured:</b> ${new Date(photo.timestamp).toLocaleString()}<br/>
        <b>Accuracy:</b> ${photo.location.accuracy ? Math.round(photo.location.accuracy) + 'm' : 'Unknown'}<br/>
        <b>Size:</b> ${(photo.originalSize / 1024).toFixed(1)} KB<br/>
        <img src="${photo.filename}" width="200" style="border-radius: 8px; margin-top: 10px;"/>
      ]]></description>
      <styleUrl>#photo-style</styleUrl>
      <TimeStamp>
        <when>${timestamp}</when>
      </TimeStamp>
      <Point>
        <coordinates>${photo.location.longitude},${photo.location.latitude},0</coordinates>
      </Point>
    </Placemark>`
      }).join('')

    const kmlFooter = `
  </Document>
</kml>`

    return kmlHeader + placemarks + kmlFooter
  }

  // Export all session photos as KMZ (KML + images)
  const exportPhotosAsKMZ = async () => {
    if (sessionPhotos.value.length === 0) {
      throw new Error('No photos to export')
    }

    const geotaggedPhotos = sessionPhotos.value.filter(photo => photo.location)
    if (geotaggedPhotos.length === 0) {
      throw new Error('No geotagged photos to export')
    }

    try {
      const zip = new JSZip()
      
      // Add KML file
      const kmlContent = createKMLContent()
      zip.file('doc.kml', kmlContent)
      
      // Add images to the KMZ
      for (const photo of geotaggedPhotos) {
        const base64Data = photo.data.split(',')[1]
        zip.file(photo.filename, base64Data, { base64: true })
      }
      
      const content = await zip.generateAsync({ type: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(content)
      link.download = `aerafield_session_photos_${new Date().toISOString().split('T')[0]}.kmz`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      return true
    } catch (error) {
      console.error('Error exporting photos as KMZ:', error)
      throw error
    }
  }

  // Get photos with location data for map markers
  const getGeotaggedPhotos = () => {
    return sessionPhotos.value.filter(photo => photo.location)
  }

  // Initialize session on composable load
  initializeSession()

  return {
    sessionPhotos: readonly(sessionPhotos),
    isSessionActive: readonly(isSessionActive),
    startSession,
    endSession,
    addPhotoToSession,
    removePhotoFromSession,
    exportPhotosAsZip,
    exportPhotosAsKMZ,
    getGeotaggedPhotos,
    initializeSession
  }
}