# AeraField - PWA Mobile Web App Specification

## Overview

**AeraField** is a mobile-first Progressive Web App (PWA) built using **Vue.js** and **Leaflet.js**. It is intended for field navigation and geospatial data interaction by Aera company personnel. The app should behave like a native mobile app on iOS and Android and is restricted to mobile phones and tablets only.

## Device Restriction

- On initial load, the app will detect the screen size.
- If the screen is larger than a tablet (e.g., >1024px width), the app will display a full-screen message:
  > "AeraField is available on mobile and tablet devices only. Please switch to a supported device."
- All app content and interaction will be blocked in this state.

## Core Technologies

- **Framework**: Vue.js
- **Mapping Library**: Leaflet.js
- **Basemap**: ESRI Light or Dark Canvas (without labels)
- **Offline Support**: Service Worker
- **Installability**: Fully installable on iOS and Android via `Add to Home Screen`

## PWA Configuration

- `manifest.json`:
  - `name`: AeraField
  - `display`: standalone
  - `theme_color`: dark with teal highlights
  - Include app icons for Android and iOS
- `service-worker.js`:
  - Caches map tiles
  - Caches GeoJSON files
  - Supports offline map and layer access

## Folder Structure

```
/aerafield-pwa/
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── App.vue
│   ├── main.js
│   ├── components/
│   │   ├── MapView.vue
│   │   ├── BottomNav.vue
│   │   ├── LayerPanel.vue
│   │   └── DeviceGuard.vue
│   ├── composables/
│   │   └── useGeoJSONLoader.js
│   └── styles/
│       └── app.css
├── data/
│   └── *.geojson
├── service-worker.js
└── package.json
```

## Map Features

- Leaflet map fills full screen
- Disable scroll wheel zoom
- Enable gesture control (touch, pinch, drag)
- Load ESRI basemap without labels
- Automatically detect and load all `.geojson` files from the `/data` folder
  - Each file renders as a separate layer
  - File name is used as the layer name
  - Single symbol styling: transparent fill, teal stroke, 2px
  - Tap on feature shows popup with attributes in card format
- Floating GPS Button:
  - Centers the map on user's location using `navigator.geolocation`

## Mobile UI Design

- Inspired by **Flutter app** UI patterns
- Features:
  - Circular buttons with shadows
  - Smooth bottom navigation bar:
    - Home, Map, Layers, Locate Me, Settings
  - FAB for GPS
  - Sliding panels and modals where needed
  - Responsive spacing and sizing for mobile usability

## Layer Management

- All loaded layers:
  - Appear in the Layer Panel
  - Are toggleable (show/hide)
  - Apply consistent, readable styling
  - Can be interacted with for popups

## Future-Proofing

- Design prepared for later additions:
  - Drawing tools
  - Attribute-based filtering
  - Embedded forms
  - Uploadable attachments or photos per feature

---

This file defines the official structure, logic, and user experience for the development of **AeraField**, Aera’s internal mobile field navigation app.

