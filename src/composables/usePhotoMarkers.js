import { ref, watch } from 'vue'
import maplibregl from 'maplibre-gl'

export function usePhotoMarkers(mapInstance) {
  const photoMarkers = ref(new Map())

  // Create custom photo marker element
  const createPhotoMarkerElement = (thumbnail) => {
    const markerElement = document.createElement('div')
    markerElement.className = 'custom-photo-marker'
    
    markerElement.innerHTML = `
      <div class="photo-marker">
        <div class="photo-marker-inner">
          <img src="${thumbnail}" alt="Photo" />
        </div>
        <div class="photo-marker-pin"></div>
      </div>
    `
    
    markerElement.style.cssText = `
      width: 40px;
      height: 50px;
      cursor: pointer;
    `
    
    return markerElement
  }

  // Add photo marker to map
  const addPhotoMarker = (photo) => {
    if (!mapInstance.value || !photo.location) return null

    const markerElement = createPhotoMarkerElement(photo.thumbnail)
    
    const marker = new maplibregl.Marker(markerElement)
      .setLngLat([photo.location.longitude, photo.location.latitude])
      .addTo(mapInstance.value)

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

    const popup = new maplibregl.Popup({
      maxWidth: '300px',
      className: 'photo-marker-popup'
    }).setHTML(popupContent)

    marker.setPopup(popup)

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
    if (marker) {
      marker.remove()
      photoMarkers.value.delete(photoId)
    }
  }

  // Clear all photo markers
  const clearAllPhotoMarkers = () => {
    photoMarkers.value.forEach((marker) => {
      marker.remove()
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
      const lngLat = marker.getLngLat()
      mapInstance.value.flyTo({
        center: lngLat,
        zoom: Math.max(mapInstance.value.getZoom(), 16)
      })
      if (marker.getPopup()) {
        marker.togglePopup()
      }
    }
  }

  // Get all photo marker positions for bounds calculation
  const getPhotoMarkerBounds = () => {
    const positions = []
    photoMarkers.value.forEach((marker) => {
      const lngLat = marker.getLngLat()
      positions.push([lngLat.lng, lngLat.lat])
    })
    
    if (positions.length === 0) return null
    
    const lngs = positions.map(pos => pos[0])
    const lats = positions.map(pos => pos[1])
    
    return [
      [Math.min(...lngs), Math.min(...lats)], // southwest
      [Math.max(...lngs), Math.max(...lats)]  // northeast
    ]
  }

  // Zoom to fit all photo markers
  const fitPhotoMarkers = () => {
    const bounds = getPhotoMarkerBounds()
    if (bounds && mapInstance.value) {
      mapInstance.value.fitBounds(bounds, {
        padding: 20,
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