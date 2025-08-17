import JSZip from 'jszip'

export function useKMLLoader() {
  
  const parseKMLFile = async (file) => {
    const text = await file.text()
    return parseKMLText(text)
  }

  const parseKMZFile = async (file) => {
    try {
      const zip = new JSZip()
      const arrayBuffer = await file.arrayBuffer()
      const contents = await zip.loadAsync(arrayBuffer, { 
        checkCRC32: false,
        optimizedBinaryString: false 
      })
      
      let kmlFile = null
      for (const [filename, fileData] of Object.entries(contents.files)) {
        if (filename.toLowerCase().endsWith('.kml') && !fileData.dir) {
          kmlFile = fileData
          break
        }
      }
      
      if (!kmlFile) {
        throw new Error('No KML file found in KMZ archive')
      }
      
      const kmlText = await kmlFile.async('text')
      return parseKMLText(kmlText)
    } catch (error) {
      if (error.message.includes('central directory') || error.message.includes('corrupted')) {
        throw new Error('Invalid or corrupted KMZ file. Please check the file and try again.')
      }
      throw new Error(`Failed to extract KMZ file: ${error.message}`)
    }
  }

  const parseKMLText = (kmlText) => {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml')
    
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid KML file format')
    }

    const features = []
    
    const placemarks = xmlDoc.getElementsByTagName('Placemark')
    
    for (let i = 0; i < placemarks.length; i++) {
      const placemark = placemarks[i]
      const feature = parsePlacemark(placemark)
      if (feature) {
        features.push(feature)
      }
    }

    return {
      type: 'FeatureCollection',
      features: features
    }
  }

  const parsePlacemark = (placemark) => {
    const name = getElementText(placemark, 'name') || 'Unnamed'
    const description = getElementText(placemark, 'description') || ''
    
    const geometry = parseGeometry(placemark)
    if (!geometry) return null

    const style = parseStyle(placemark)
    
    const properties = {
      name: name,
      description: description,
      style: style || {}
    }

    const extendedData = placemark.getElementsByTagName('ExtendedData')[0]
    if (extendedData) {
      const simpleData = extendedData.getElementsByTagName('SimpleData')
      for (let i = 0; i < simpleData.length; i++) {
        const data = simpleData[i]
        const name = data.getAttribute('name')
        const value = data.textContent
        if (name) {
          properties[name] = value
        }
      }
    }

    return {
      type: 'Feature',
      properties: properties,
      geometry: geometry
    }
  }

  const parseGeometry = (placemark) => {
    const point = placemark.getElementsByTagName('Point')[0]
    if (point) {
      return parsePoint(point)
    }

    const lineString = placemark.getElementsByTagName('LineString')[0]
    if (lineString) {
      return parseLineString(lineString)
    }

    const polygon = placemark.getElementsByTagName('Polygon')[0]
    if (polygon) {
      return parsePolygon(polygon)
    }

    const multiGeometry = placemark.getElementsByTagName('MultiGeometry')[0]
    if (multiGeometry) {
      return parseMultiGeometry(multiGeometry)
    }

    return null
  }

  const parsePoint = (pointElement) => {
    const coordinates = getElementText(pointElement, 'coordinates')
    if (!coordinates) return null

    const coords = parseCoordinates(coordinates)[0]
    return {
      type: 'Point',
      coordinates: coords
    }
  }

  const parseLineString = (lineElement) => {
    const coordinates = getElementText(lineElement, 'coordinates')
    if (!coordinates) return null

    const coords = parseCoordinates(coordinates)
    return {
      type: 'LineString',
      coordinates: coords
    }
  }

  const parsePolygon = (polygonElement) => {
    const outerBoundary = polygonElement.getElementsByTagName('outerBoundaryIs')[0]
    if (!outerBoundary) return null

    const outerRing = outerBoundary.getElementsByTagName('LinearRing')[0]
    if (!outerRing) return null

    const outerCoords = getElementText(outerRing, 'coordinates')
    if (!outerCoords) return null

    const coordinates = [parseCoordinates(outerCoords)]

    const innerBoundaries = polygonElement.getElementsByTagName('innerBoundaryIs')
    for (let i = 0; i < innerBoundaries.length; i++) {
      const innerRing = innerBoundaries[i].getElementsByTagName('LinearRing')[0]
      if (innerRing) {
        const innerCoords = getElementText(innerRing, 'coordinates')
        if (innerCoords) {
          coordinates.push(parseCoordinates(innerCoords))
        }
      }
    }

    return {
      type: 'Polygon',
      coordinates: coordinates
    }
  }

  const parseMultiGeometry = (multiGeomElement) => {
    const geometries = []
    
    const points = multiGeomElement.getElementsByTagName('Point')
    for (let i = 0; i < points.length; i++) {
      const geom = parsePoint(points[i])
      if (geom) geometries.push(geom)
    }

    const lineStrings = multiGeomElement.getElementsByTagName('LineString')
    for (let i = 0; i < lineStrings.length; i++) {
      const geom = parseLineString(lineStrings[i])
      if (geom) geometries.push(geom)
    }

    const polygons = multiGeomElement.getElementsByTagName('Polygon')
    for (let i = 0; i < polygons.length; i++) {
      const geom = parsePolygon(polygons[i])
      if (geom) geometries.push(geom)
    }

    if (geometries.length === 1) {
      return geometries[0]
    } else if (geometries.length > 1) {
      return {
        type: 'GeometryCollection',
        geometries: geometries
      }
    }

    return null
  }

  const parseCoordinates = (coordString) => {
    const coords = coordString.trim().split(/\s+/)
    const result = []
    
    for (const coord of coords) {
      if (coord.trim()) {
        const parts = coord.split(',')
        if (parts.length >= 2) {
          const lng = parseFloat(parts[0])
          const lat = parseFloat(parts[1])
          
          if (!isNaN(lng) && !isNaN(lat)) {
            result.push([lng, lat])
          }
        }
      }
    }
    
    return result
  }

  const parseStyle = (placemark) => {
    const style = {
      fill: '#20b2aa',
      stroke: '#20b2aa', 
      'stroke-width': 2,
      'fill-opacity': 0.3,
      radius: 6
    }

    const styleUrl = getElementText(placemark, 'styleUrl')
    if (styleUrl) {
      const styleId = styleUrl.replace('#', '')
      const styleElement = placemark.ownerDocument.getElementById(styleId)
      if (styleElement) {
        return parseStyleElement(styleElement, style)
      }
    }

    const inlineStyle = placemark.getElementsByTagName('Style')[0]
    if (inlineStyle) {
      return parseStyleElement(inlineStyle, style)
    }

    return style
  }

  const parseStyleElement = (styleElement, defaultStyle) => {
    const style = { ...defaultStyle }

    const lineStyle = styleElement.getElementsByTagName('LineStyle')[0]
    if (lineStyle) {
      const color = getElementText(lineStyle, 'color')
      if (color) {
        style.stroke = convertKMLColor(color)
      }
      const width = getElementText(lineStyle, 'width')
      if (width) {
        style['stroke-width'] = parseFloat(width)
      }
    }

    const polyStyle = styleElement.getElementsByTagName('PolyStyle')[0]
    if (polyStyle) {
      const color = getElementText(polyStyle, 'color')
      if (color) {
        style.fill = convertKMLColor(color)
      }
      const outline = getElementText(polyStyle, 'outline')
      if (outline === '0') {
        style['stroke-width'] = 0
      }
    }

    const iconStyle = styleElement.getElementsByTagName('IconStyle')[0]
    if (iconStyle) {
      const scale = getElementText(iconStyle, 'scale')
      if (scale) {
        style.radius = parseFloat(scale) * 6
      }
      const color = getElementText(iconStyle, 'color')
      if (color) {
        style.fill = convertKMLColor(color)
      }
    }

    return style
  }

  const convertKMLColor = (kmlColor) => {
    if (!kmlColor || kmlColor.length !== 8) {
      return '#20b2aa'
    }

    const a = kmlColor.substring(0, 2)
    const b = kmlColor.substring(2, 4)
    const g = kmlColor.substring(4, 6)
    const r = kmlColor.substring(6, 8)

    return `#${r}${g}${b}`
  }

  const getElementText = (parent, tagName) => {
    const element = parent.getElementsByTagName(tagName)[0]
    return element ? element.textContent.trim() : null
  }

  return {
    parseKMLFile,
    parseKMZFile
  }
}