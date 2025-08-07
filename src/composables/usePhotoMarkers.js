import { ref, watch } from 'vue'
import L from 'leaflet'

export function usePhotoMarkers(mapInstance) {
  const photoMarkers = ref(new Map())

  // Create custom photo marker icon
  const createPhotoIcon = (thumbnail) => {
    const iconHtml = `
      <div class="photo-marker">
        <div class="photo-marker-inner">
          <img src="${thumbnail}" alt="Photo" />
        </div>
        <div class="photo-marker-pin"></div>
      </div>
    `

    return L.divIcon({
      html: iconHtml,
      className: 'custom-photo-marker',
      iconSize: [40, 50],
      iconAnchor: [20, 45],
      popupAnchor: [0, -45]
    })
  }

  // Add photo marker to map
  const addPhotoMarker = (photo) => {
    if (!mapInstance.value || !photo.location) return null

    const icon = createPhotoIcon(photo.thumbnail)
    const marker = L.marker(
      [photo.location.latitude, photo.location.longitude],
      { icon }
    )

    // Create popup content
    const popupContent = `
      <div class="photo-popup">
        <div class="photo-popup-header">
          <h3>📷 Photo</h3>
          <span class="photo-timestamp">${new Date(photo.timestamp).toLocaleString()}</span>
        </div>
        <div class="photo-popup-content">
          <img src="${photo.data}" alt="Captured photo" class="popup-photo-full" />
          <div class="photo-location-info">
            <div class="location-coords">
              <strong>Location:</strong><br/>
              ${photo.location.latitude.toFixed(6)}, ${photo.location.longitude.toFixed(6)}
            </div>
            <div class="location-accuracy">
              <strong>Accuracy:</strong> ${photo.location.accuracy ? Math.round(photo.location.accuracy) + 'm' : 'Unknown'}
            </div>
          </div>
        </div>
        <div class="photo-popup-actions">
          <button onclick="downloadPhoto('${photo.id}')" class="download-photo-btn">
            📥 Download
          </button>
        </div>
      </div>
    `

    const popup = L.popup({
      maxWidth: 300,
      maxHeight: 500,
      className: 'photo-marker-popup',
      autoPan: true,
      autoPanPadding: [20, 20],
      autoClose: false,
      closeOnEscapeKey: true,
      keepInView: true,
      closeButton: true
    }).setContent(popupContent)

    marker.bindPopup(popup)
    marker.addTo(mapInstance.value)

    // Store reference
    photoMarkers.value.set(photo.id, marker)

    // Add global download function
    window.downloadPhoto = (photoId) => {
      const photoData = getPhotoData(photoId)
      if (photoData) {
        const link = document.createElement('a')
        link.href = photoData.data
        link.download = photoData.filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    }

    return marker
  }

  // Remove photo marker from map
  const removePhotoMarker = (photoId) => {
    const marker = photoMarkers.value.get(photoId)
    if (marker && mapInstance.value) {
      mapInstance.value.removeLayer(marker)
      photoMarkers.value.delete(photoId)
    }
  }

  // Clear all photo markers
  const clearAllPhotoMarkers = () => {
    if (!mapInstance.value) return

    photoMarkers.value.forEach((marker) => {
      mapInstance.value.removeLayer(marker)
    })
    photoMarkers.value.clear()
  }

  // Get photo markers count
  const getPhotoMarkersCount = () => {
    return photoMarkers.value.size
  }

  // Fly to photo marker
  const flyToPhotoMarker = (photoId) => {
    const marker = photoMarkers.value.get(photoId)
    if (marker && mapInstance.value) {
      const latlng = marker.getLatLng()
      mapInstance.value.flyTo(latlng, Math.max(mapInstance.value.getZoom(), 16))
      marker.openPopup()
    }
  }

  // Get all photo marker positions for bounds calculation
  const getPhotoMarkerBounds = () => {
    const positions = []
    photoMarkers.value.forEach((marker) => {
      positions.push(marker.getLatLng())
    })
    return positions.length > 0 ? L.latLngBounds(positions) : null
  }

  // Zoom to fit all photo markers
  const fitPhotoMarkers = () => {
    const bounds = getPhotoMarkerBounds()
    if (bounds && mapInstance.value) {
      mapInstance.value.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 16
      })
    }
  }

  // Store photo data for download functionality
  let photoDataStore = new Map()
  
  const getPhotoData = (photoId) => {
    return photoDataStore.get(photoId)
  }

  const setPhotoData = (photoId, photoData) => {
    photoDataStore.set(photoId, photoData)
  }

  const clearPhotoData = () => {
    photoDataStore.clear()
  }

  return {
    photoMarkers,
    addPhotoMarker,
    removePhotoMarker,
    clearAllPhotoMarkers,
    getPhotoMarkersCount,
    flyToPhotoMarker,
    getPhotoMarkerBounds,
    fitPhotoMarkers,
    setPhotoData,
    getPhotoData,
    clearPhotoData
  }
}