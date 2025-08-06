const CACHE_NAME = 'aerafield-v2'
const DATA_CACHE_NAME = 'aerafield-data-v2'
const TILE_CACHE_NAME = 'aerafield-tiles-v2'

// Cache configuration
const TILE_CACHE_SIZE_LIMIT = 50 * 1024 * 1024 // 50MB for tiles
const TILE_CACHE_MAX_ENTRIES = 2000
const CACHE_EXPIRY_DAYS = 7

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

// GeoJSON data patterns
const GEOJSON_URL_PATTERNS = [
  /^.*\/data\/.*\.geojson$/
]

// Cache management utilities
async function manageTileCache() {
  try {
    const cache = await caches.open(TILE_CACHE_NAME)
    const requests = await cache.keys()
    
    // Check cache size and entries
    if (requests.length > TILE_CACHE_MAX_ENTRIES) {
      console.log('[ServiceWorker] Cache exceeded max entries, cleaning up')
      
      // Sort by last accessed (we'll use a simple approach and remove oldest 20%)
      const toDelete = requests.slice(0, Math.floor(requests.length * 0.2))
      await Promise.all(toDelete.map(request => cache.delete(request)))
    }
    
    // Clean expired entries
    const expiryTime = Date.now() - (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    for (const request of requests) {
      const response = await cache.match(request)
      if (response) {
        const cachedTime = response.headers.get('sw-cached-time')
        if (cachedTime && parseInt(cachedTime) < expiryTime) {
          await cache.delete(request)
        }
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Cache management error:', error)
  }
}

async function addTileToCache(request, response) {
  try {
    const cache = await caches.open(TILE_CACHE_NAME)
    
    // Add timestamp header for expiry management
    const responseWithTimestamp = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'sw-cached-time': Date.now().toString()
      }
    })
    
    await cache.put(request, responseWithTimestamp)
    
    // Periodically manage cache (every 50th tile)
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

  // Handle tile requests (map tiles) - offline-first with lazy caching
  if (isTileRequest(request.url)) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        try {
          // Try cache first for immediate response
          const cachedResponse = await cache.match(request)
          
          if (cachedResponse) {
            // Check if cache is still valid
            const cachedTime = cachedResponse.headers.get('sw-cached-time')
            const expiryTime = Date.now() - (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
            
            if (cachedTime && parseInt(cachedTime) > expiryTime) {
              console.log('[ServiceWorker] Serving cached tile:', request.url)
              return cachedResponse
            }
          }

          // Fetch from network
          console.log('[ServiceWorker] Fetching tile from network:', request.url)
          const networkResponse = await fetch(request)
          
          if (networkResponse.ok && networkResponse.status === 200) {
            // Cache the successful response for offline use
            addTileToCache(request, networkResponse.clone())
            return networkResponse
          } else {
            // Network failed, return cached version if available
            if (cachedResponse) {
              console.log('[ServiceWorker] Network failed, serving expired cache:', request.url)
              return cachedResponse
            }
            throw new Error(`Tile fetch failed: ${networkResponse.status}`)
          }
        } catch (error) {
          console.log('[ServiceWorker] Tile fetch error, checking cache:', error.message)
          
          // Network is down, try to serve from cache regardless of expiry
          const cachedResponse = await cache.match(request)
          if (cachedResponse) {
            console.log('[ServiceWorker] Serving cached tile (offline):', request.url)
            return cachedResponse
          }
          
          // Return transparent tile as fallback
          console.log('[ServiceWorker] No cached tile available, returning transparent fallback')
          return new Response(
            // 1x1 transparent PNG
            new Uint8Array([
              137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 11, 73, 68, 65, 84, 120, 156, 99, 248, 15, 0, 1, 0, 1, 0, 24, 221, 141, 219, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
            ]),
            {
              status: 200,
              statusText: 'OK',
              headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'no-cache'
              }
            }
          )
        }
      })
    )
    return
  }

  // Handle GeoJSON requests
  if (GEOJSON_URL_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.status === 200) {
              cache.put(request, response.clone())
            }
            return response
          })

          // Return cached version immediately, then update in background
          return cachedResponse || fetchPromise
        })
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