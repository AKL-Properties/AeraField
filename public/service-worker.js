const CACHE_NAME = 'aerafield-v5'
const DATA_CACHE_NAME = 'aerafield-data-v5'
const TILE_CACHE_NAME = 'aerafield-tiles-v5'

// Cache configuration
const TILE_CACHE_SIZE_LIMIT = 50 * 1024 * 1024 // 50MB for tiles
const TILE_CACHE_MAX_ENTRIES = 2000
// No expiration - tiles are cached permanently for offline use

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon.svg'
]

// Comprehensive tile URL patterns for various providers
const TILE_URL_PATTERNS = [
  // ESRI/ArcGIS
  /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/.*\/MapServer\/tile\//,
  /^https:\/\/services\.arcgisonline\.com\/ArcGIS\/rest\/services\/.*\/MapServer\/tile\//,
  /^https:\/\/.*\.arcgisonline\.com\/.*\/MapServer\/tile\//,
  // Mapbox
  /^https:\/\/api\.mapbox\.com\/v4\/.*\.(png|jpg|jpeg)(\?.*)?$/,
  /^https:\/\/.*\.tiles\.mapbox\.com\/.*\.(png|jpg|jpeg)(\?.*)?$/,
  // OpenStreetMap and similar TMS
  /^https:\/\/.*\.tile\.openstreetmap\.org\/.*\.(png|jpg|jpeg)$/,
  /^https:\/\/.*\.(png|jpg|jpeg).*\/\d+\/\d+\/\d+\.(png|jpg|jpeg)(\?.*)?$/,
  // Generic tile patterns (z/x/y format)
  /\/\d+\/\d+\/\d+\.(png|jpg|jpeg)(\?.*)?$/
]


// Cache management utilities
async function manageTileCache() {
  try {
    const cache = await caches.open(TILE_CACHE_NAME)
    const requests = await cache.keys()
    
    // Only manage by entry count, no expiration
    if (requests.length > TILE_CACHE_MAX_ENTRIES) {
      console.log('[ServiceWorker] Cache exceeded max entries, cleaning up oldest 20%')
      
      // Remove oldest 20% based on cache order (first in, first out)
      const toDelete = requests.slice(0, Math.floor(requests.length * 0.2))
      await Promise.all(toDelete.map(request => cache.delete(request)))
    }
  } catch (error) {
    console.error('[ServiceWorker] Cache management error:', error)
  }
}

async function addTileToCache(request, response) {
  try {
    const cache = await caches.open(TILE_CACHE_NAME)
    
    // Cache the response without timestamp (no expiration needed)
    await cache.put(request, response)
    
    // Periodically manage cache by size only (every 50th tile)
    if (Math.random() < 0.02) {
      manageTileCache()
    }
  } catch (error) {
    console.error('[ServiceWorker] Error caching tile:', error)
  }
}

function isTileRequest(url) {
  return TILE_URL_PATTERNS.some(pattern => pattern.test(url))
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install')
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        console.log('[ServiceWorker] Caching static assets')
        
        // Cache assets one by one to avoid failing on missing files
        const cachePromises = STATIC_ASSETS.filter(url => !url.startsWith('http')).map(async (url) => {
          try {
            await cache.add(url)
            console.log('[ServiceWorker] Cached:', url)
          } catch (error) {
            console.warn('[ServiceWorker] Failed to cache:', url, error.message)
          }
        })
        
        await Promise.allSettled(cachePromises)
      })
      .then(() => {
        self.skipWaiting()
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME && cacheName !== TILE_CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => {
      self.clients.claim()
    })
  )
})

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Handle tile requests (map tiles) - cache-first for offline reliability
  if (isTileRequest(request.url)) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        // First check cache for immediate response
        const cachedResponse = await cache.match(request)
        
        try {
          // Try network for fresh tiles (with timeout for offline detection)
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
          
          const networkResponse = await fetch(request, {
            mode: 'cors',
            cache: 'default',
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
          
          if (networkResponse.ok && networkResponse.status === 200) {
            // Cache the successful response for future offline use
            addTileToCache(request, networkResponse.clone())
            return networkResponse
          } else if (cachedResponse) {
            // Network failed but we have cache
            console.log('[ServiceWorker] Network failed, serving cached tile:', request.url)
            return cachedResponse
          } else {
            throw new Error(`Network response failed: ${networkResponse.status}`)
          }
        } catch (networkError) {
          // Network failed or timed out
          if (cachedResponse) {
            console.log('[ServiceWorker] Network unavailable, serving cached tile:', request.url)
            return cachedResponse
          }
          
          // No cache available, let request fail
          console.log('[ServiceWorker] No cached tile available, letting request fail')
          throw networkError
        }
      })
    )
    return
  }


  // Handle Supabase Auth requests - always try network first
  if (request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(request).then((response) => {
        // Cache successful auth responses for offline use
        if (response.ok && request.method === 'GET') {
          caches.open(DATA_CACHE_NAME).then((cache) => {
            cache.put(request, response.clone())
          })
        }
        return response
      }).catch(() => {
        // Try to serve from cache for GET requests
        if (request.method === 'GET') {
          return caches.match(request)
        }
        throw new Error('Network unavailable')
      })
    )
    return
  }

  // Handle all other requests - cache first strategy for static assets
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }

        return fetch(request).then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        }).catch(() => {
          // For navigation requests, return the cached index.html
          if (request.mode === 'navigate') {
            return caches.match('/')
          }
          throw new Error('Network unavailable')
        })
      })
    )
  }
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync', event.tag)
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle any queued offline actions here
      Promise.resolve()
    )
  }
})

// Message handler for cache management
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data)
  
  if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      clearAllCaches().then(() => {
        // Send success message back to the client
        event.ports[0].postMessage({ success: true, message: 'All caches cleared successfully' })
      }).catch((error) => {
        console.error('[ServiceWorker] Error clearing caches:', error)
        event.ports[0].postMessage({ success: false, message: 'Failed to clear caches: ' + error.message })
      })
    )
  } else if (event.data && event.data.type === 'CLEAR_TILES_CACHE') {
    event.waitUntil(
      clearTilesCache().then(() => {
        event.ports[0].postMessage({ success: true, message: 'Map tiles cache cleared successfully' })
      }).catch((error) => {
        console.error('[ServiceWorker] Error clearing tiles cache:', error)
        event.ports[0].postMessage({ success: false, message: 'Failed to clear tiles cache: ' + error.message })
      })
    )
  } else if (event.data && event.data.type === 'GET_CACHE_INFO') {
    event.waitUntil(
      getCacheInfo().then((info) => {
        event.ports[0].postMessage({ success: true, cacheInfo: info })
      }).catch((error) => {
        console.error('[ServiceWorker] Error getting cache info:', error)
        event.ports[0].postMessage({ success: false, message: 'Failed to get cache info: ' + error.message })
      })
    )
  }
})

// Cache management functions
async function clearAllCaches() {
  console.log('[ServiceWorker] Clearing all caches...')
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))
  console.log('[ServiceWorker] All caches cleared')
}

async function clearTilesCache() {
  console.log('[ServiceWorker] Clearing tiles cache...')
  await caches.delete(TILE_CACHE_NAME)
  console.log('[ServiceWorker] Tiles cache cleared')
}

async function getCacheInfo() {
  const cacheNames = await caches.keys()
  const cacheInfo = {}
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    cacheInfo[cacheName] = {
      entryCount: keys.length,
      urls: keys.slice(0, 5).map(req => req.url) // Show first 5 URLs as examples
    }
  }
  
  return cacheInfo
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received')
  
  const options = {
    body: event.data ? event.data.text() : 'AeraField notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: 'Open AeraField',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192.png'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification('AeraField', options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click received')
  
  event.notification.close()
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})