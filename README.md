# AeraField PWA

A mobile-first Progressive Web App for field navigation and geospatial data interaction, built for Aera company personnel.

## ✅ Completed Features

### 🔐 Authentication
- **Supabase Integration**: Secure login with session persistence
- **Access Control**: No map or interface accessible without authentication
- **Offline Session**: Auth data cached for offline use

### 📱 Mobile-First Design
- **Device Restriction**: Blocks access on screens >1024px width
- **Flutter-Inspired UI**: Rounded buttons, shadows, smooth animations
- **Dark Theme**: Dark background with teal accents (#00bcd4, #26a69a)
- **Touch Optimized**: Proper touch targets and gesture handling

### 🗺️ Mapping & Navigation
- **Leaflet Integration**: Full-screen interactive map
- **ESRI Basemap**: Dark canvas without labels for clean visualization
- **GPS Location**: Floating action button for user location
- **Touch Controls**: Pinch, zoom, drag - no scroll wheel zoom

### 📊 Layer Management
- **Auto GeoJSON Loading**: Automatically loads all files from `/data` folder
- **Layer Panel**: Toggle layers on/off with smooth sliding panel
- **Consistent Styling**: Transparent fill, teal stroke (2px) for all features
- **Feature Popups**: Tap any feature to see properties in card format

### 🔄 PWA Features
- **Installable**: Full PWA with manifest.json
- **Service Worker**: Caches tiles, GeoJSON, and sessions
- **Offline Support**: Works without internet connection
- **Background Sync**: Handles offline actions when reconnected

### 🧭 Navigation
- **Bottom Navigation**: Home, Map, Layers, GPS, Settings
- **Responsive Tabs**: Active states with animations
- **Quick Actions**: Easy access to main features

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd AeraField
   npm install
   ```

2. **Add app icons** (see `/public/ICONS_NEEDED.md` for details):
   - `icon-192.png` (192x192)
   - `icon-512.png` (512x512)
   - `screenshot-mobile.png` (390x844)

3. **Add GeoJSON data:**
   - Place `.geojson` files in the `/data` directory
   - Update the file list in `src/hooks/useGeoJSONLoader.js`

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

## 📁 Project Structure

```
/AeraField/
├── public/
│   ├── index.html          # Main HTML entry point
│   ├── manifest.json       # PWA manifest
│   ├── service-worker.js   # Service worker for offline support
│   └── ICONS_NEEDED.md     # Icon requirements
├── src/
│   ├── components/
│   │   ├── DeviceGuard.jsx     # Screen size restriction
│   │   ├── Login.jsx           # Supabase authentication
│   │   ├── MapView.jsx         # Leaflet map component
│   │   ├── BottomNav.jsx       # Bottom navigation
│   │   └── LayerPanel.jsx      # Layer management panel
│   ├── hooks/
│   │   ├── useAuth.js          # Authentication state management
│   │   └── useGeoJSONLoader.js # GeoJSON file loader
│   ├── lib/
│   │   └── supabase.js         # Supabase client configuration
│   ├── App.jsx             # Main app component
│   └── main.jsx           # React entry point
├── data/
│   ├── sample-points.geojson      # Example point data
│   └── project-boundaries.geojson # Example polygon data
└── CLAUDE.md              # Project specifications
```

## 🔧 Configuration

### Supabase Setup
The app is configured with the provided Supabase credentials:
- **URL**: `https://yckvroohruvkhltaqrwk.supabase.co`
- **API Key**: Already configured in `src/lib/supabase.js`

### Adding New GeoJSON Layers
1. Place `.geojson` files in the `/data` directory
2. Add filenames to the array in `src/hooks/useGeoJSONLoader.js`
3. Files will automatically appear in the Layer Panel

### Customizing Styling
- Map feature styles: Edit `src/components/MapView.jsx`
- UI colors and theme: Modify CSS variables in components
- App icons: Replace files in `/public` directory

## 📱 Mobile Installation

### iOS (Safari)
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Confirm installation

### Android (Chrome)
1. Open the app in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home Screen"
4. Confirm installation

## 🔒 Security Features

- **Authentication Required**: No access without valid Supabase session
- **Session Persistence**: Secure session storage for offline use
- **API Key Protection**: Supabase RLS (Row Level Security) recommended
- **HTTPS Only**: Service worker requires secure connection

## 🌐 Offline Capabilities

The app works offline by caching:
- ✅ Map tiles (ESRI basemap)
- ✅ GeoJSON layer data
- ✅ User authentication sessions
- ✅ App shell and static assets

## 🔮 Future Enhancements

The architecture supports future additions:
- Drawing tools for field annotations
- Attribute-based layer filtering
- Embedded forms for data collection
- Photo attachments per feature
- Push notifications for field updates

## 🛠️ Development Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## 📝 Notes

- **Device Restriction**: Shows full-screen message on desktop (>1024px)
- **Sample Data**: Includes example GeoJSON files for testing
- **PWA Ready**: Fully installable and offline-capable
- **Mobile Optimized**: Designed specifically for field use on phones/tablets

---

**AeraField** - Field navigation made simple. 🗺️📱