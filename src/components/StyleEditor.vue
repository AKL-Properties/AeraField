<template>
  <div v-if="isOpen" class="style-editor-overlay" @click="handleOverlayClick">
    <div class="style-editor-modal" @click.stop>
      <div class="style-editor-header">
        <h3>Style Layer: {{ layerName }}</h3>
        <button @click="closeEditor" class="close-button">
          <font-awesome-icon :icon="'times'" />
        </button>
      </div>

      <div class="style-editor-content">
        <!-- Style Type Selection -->
        <div class="style-section">
          <h4>Style Type</h4>
          <div class="style-type-tabs">
            <button 
              :class="['style-tab', { active: styleType === 'simple' }]"
              @click="styleType = 'simple'"
            >
              Simple
            </button>
            <button 
              :class="['style-tab', { active: styleType === 'categorical' }]"
              @click="styleType = 'categorical'"
            >
              Categorical
            </button>
            <button 
              :class="['style-tab', { active: styleType === 'graduated' }]"
              @click="styleType = 'graduated'"
            >
              Graduated
            </button>
          </div>
        </div>

        <!-- Simple Style -->
        <div v-if="styleType === 'simple'" class="style-section">
          <div class="style-controls">
            <div class="control-group">
              <label>Fill Color</label>
              <div class="color-input-group">
                <input 
                  type="color" 
                  v-model="simpleStyle.fillColor" 
                  class="color-picker"
                />
                <span class="color-value">{{ simpleStyle.fillColor }}</span>
              </div>
            </div>
            <div class="control-group">
              <label>Fill Opacity</label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1" 
                v-model="simpleStyle.fillOpacity"
                class="slider"
              />
              <span class="value">{{ simpleStyle.fillOpacity }}</span>
            </div>
            <div class="control-group">
              <label>Stroke Color</label>
              <div class="color-input-group">
                <input 
                  type="color" 
                  v-model="simpleStyle.strokeColor" 
                  class="color-picker"
                />
                <span class="color-value">{{ simpleStyle.strokeColor }}</span>
              </div>
            </div>
            <div class="control-group">
              <label>Stroke Width</label>
              <input 
                type="range" 
                min="0" 
                max="10" 
                step="0.5" 
                v-model="simpleStyle.strokeWidth"
                class="slider"
              />
              <span class="value">{{ simpleStyle.strokeWidth }}px</span>
            </div>
            <div class="control-group">
              <label>Stroke Opacity</label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1" 
                v-model="simpleStyle.strokeOpacity"
                class="slider"
              />
              <span class="value">{{ simpleStyle.strokeOpacity }}</span>
            </div>
          </div>
        </div>

        <!-- Categorical Style -->
        <div v-if="styleType === 'categorical'" class="style-section">
          <div class="control-group">
            <label>Classification Field</label>
            <select v-model="categoricalStyle.field" @change="updateCategoricalValues" class="field-select">
              <option value="">Select a field...</option>
              <option v-for="field in availableFields" :key="field" :value="field">
                {{ field }}
              </option>
            </select>
          </div>

          <div v-if="categoricalStyle.field && uniqueValues.length > 0" class="categorical-values">
            <h5>Value Styles</h5>
            <div v-for="(valueStyle, index) in categoricalStyle.values" :key="index" class="value-style-item">
              <div class="value-header">
                <span class="value-name">{{ valueStyle.value }}</span>
                <span class="value-count">({{ getValueCount(valueStyle.value) }} features)</span>
              </div>
              <div class="value-controls">
                <div class="color-control">
                  <label>Color</label>
                  <input 
                    type="color" 
                    v-model="valueStyle.color" 
                    class="color-picker small"
                  />
                </div>
                <div class="opacity-control">
                  <label>Opacity</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    v-model="valueStyle.opacity"
                    class="slider small"
                  />
                  <span class="value">{{ valueStyle.opacity }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Graduated Style -->
        <div v-if="styleType === 'graduated'" class="style-section">
          <div class="control-group">
            <label>Classification Field</label>
            <select v-model="graduatedStyle.field" @change="updateGraduatedRanges" class="field-select">
              <option value="">Select a numeric field...</option>
              <option v-for="field in numericFields" :key="field" :value="field">
                {{ field }}
              </option>
            </select>
          </div>

          <div class="control-group">
            <label>Number of Classes</label>
            <input 
              type="number" 
              min="2" 
              max="10" 
              v-model="graduatedStyle.classes" 
              @change="updateGraduatedRanges"
              class="number-input"
            />
          </div>

          <div class="control-group">
            <label>Color Scheme</label>
            <select v-model="graduatedStyle.colorScheme" @change="updateGraduatedColors" class="field-select">
              <option value="blues">Blues</option>
              <option value="greens">Greens</option>
              <option value="reds">Reds</option>
              <option value="oranges">Oranges</option>
              <option value="purples">Purples</option>
              <option value="grays">Grays</option>
            </select>
          </div>

          <div v-if="graduatedStyle.field && graduatedStyle.ranges.length > 0" class="graduated-ranges">
            <h5>Class Ranges</h5>
            <div v-for="(range, index) in graduatedStyle.ranges" :key="index" class="range-item">
              <div class="range-info">
                <span class="range-label">{{ formatRange(range.min, range.max) }}</span>
                <span class="range-count">({{ range.count }} features)</span>
              </div>
              <div class="range-controls">
                <input 
                  type="color" 
                  v-model="range.color" 
                  class="color-picker small"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="style-editor-actions">
        <button @click="resetToDefault" class="reset-button">
          Reset to Default
        </button>
        <button @click="applyStyle" class="apply-button" :disabled="!isValidStyle">
          Apply Style
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, inject } from 'vue'

export default {
  name: 'StyleEditor',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    layerName: {
      type: String,
      default: ''
    },
    layerData: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'apply-style'],
  setup(props, { emit }) {
    const mapInstance = inject('mapInstance', null)
    
    const styleType = ref('simple')
    const availableFields = ref([])
    const numericFields = ref([])
    const uniqueValues = ref([])
    const fieldValues = ref(new Map())

    // Simple style configuration
    const simpleStyle = ref({
      fillColor: '#1394b9',
      fillOpacity: 0.6,
      strokeColor: '#0f7a94',
      strokeWidth: 2,
      strokeOpacity: 1
    })

    // Categorical style configuration
    const categoricalStyle = ref({
      field: '',
      values: []
    })

    // Graduated style configuration  
    const graduatedStyle = ref({
      field: '',
      classes: 5,
      colorScheme: 'blues',
      ranges: []
    })

    // Color schemes for graduated styling
    const colorSchemes = {
      blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
      greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
      reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
      oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
      purples: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
      grays: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000']
    }

    const isValidStyle = computed(() => {
      if (styleType.value === 'simple') return true
      if (styleType.value === 'categorical') return categoricalStyle.value.field && categoricalStyle.value.values.length > 0
      if (styleType.value === 'graduated') return graduatedStyle.value.field && graduatedStyle.value.ranges.length > 0
      return false
    })

    // Extract field information from layer data
    const extractFields = () => {
      if (!props.layerData?.features?.length) return

      const firstFeature = props.layerData.features[0]
      if (!firstFeature.properties) return

      const fields = Object.keys(firstFeature.properties)
      availableFields.value = fields

      // Identify numeric fields
      const numericFieldList = []
      const fieldValueMap = new Map()

      fields.forEach(field => {
        const values = props.layerData.features
          .map(f => f.properties[field])
          .filter(v => v !== null && v !== undefined)
        
        fieldValueMap.set(field, values)
        
        // Check if field contains numeric values
        const numericValues = values.filter(v => !isNaN(parseFloat(v)) && isFinite(v))
        if (numericValues.length > values.length * 0.8) { // 80% of values are numeric
          numericFieldList.push(field)
        }
      })

      numericFields.value = numericFieldList
      fieldValues.value = fieldValueMap
    }

    const updateCategoricalValues = () => {
      if (!categoricalStyle.value.field) {
        uniqueValues.value = []
        categoricalStyle.value.values = []
        return
      }

      const values = fieldValues.value.get(categoricalStyle.value.field) || []
      const unique = [...new Set(values)].filter(v => v !== null && v !== undefined)
      uniqueValues.value = unique

      // Generate colors for each unique value
      const colors = generateCategoricalColors(unique.length)
      categoricalStyle.value.values = unique.map((value, index) => ({
        value,
        color: colors[index] || '#1394b9',
        opacity: 0.7
      }))
    }

    const updateGraduatedRanges = () => {
      if (!graduatedStyle.value.field) {
        graduatedStyle.value.ranges = []
        return
      }

      const values = fieldValues.value.get(graduatedStyle.value.field) || []
      const numericValues = values
        .map(v => parseFloat(v))
        .filter(v => !isNaN(v) && isFinite(v))
        .sort((a, b) => a - b)

      if (numericValues.length === 0) return

      const min = numericValues[0]
      const max = numericValues[numericValues.length - 1]
      const classes = parseInt(graduatedStyle.value.classes)
      const step = (max - min) / classes

      const ranges = []
      for (let i = 0; i < classes; i++) {
        const rangeMin = min + (step * i)
        const rangeMax = i === classes - 1 ? max : min + (step * (i + 1))
        
        const count = numericValues.filter(v => v >= rangeMin && v <= rangeMax).length
        
        ranges.push({
          min: rangeMin,
          max: rangeMax,
          count,
          color: '#1394b9'
        })
      }

      graduatedStyle.value.ranges = ranges
      updateGraduatedColors()
    }

    const updateGraduatedColors = () => {
      const scheme = colorSchemes[graduatedStyle.value.colorScheme] || colorSchemes.blues
      const ranges = graduatedStyle.value.ranges
      
      ranges.forEach((range, index) => {
        const colorIndex = Math.floor((index / (ranges.length - 1)) * (scheme.length - 1))
        range.color = scheme[colorIndex] || '#1394b9'
      })
    }

    const generateCategoricalColors = (count) => {
      const baseColors = [
        '#1394b9', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
        '#1abc9c', '#34495e', '#f1c40f', '#e67e22', '#95a5a6'
      ]
      
      const colors = []
      for (let i = 0; i < count; i++) {
        colors.push(baseColors[i % baseColors.length])
      }
      return colors
    }

    const getValueCount = (value) => {
      if (!categoricalStyle.value.field) return 0
      const values = fieldValues.value.get(categoricalStyle.value.field) || []
      return values.filter(v => v === value).length
    }

    const formatRange = (min, max) => {
      return `${min.toFixed(2)} - ${max.toFixed(2)}`
    }

    const buildMapLibreStyle = () => {
      const baseStyle = {
        'fill-outline-color': '#000000'
      }

      if (styleType.value === 'simple') {
        return {
          ...baseStyle,
          'fill-color': simpleStyle.value.fillColor,
          'fill-opacity': parseFloat(simpleStyle.value.fillOpacity),
          'fill-outline-color': simpleStyle.value.strokeColor,
          'fill-outline-width': parseFloat(simpleStyle.value.strokeWidth),
          'fill-outline-opacity': parseFloat(simpleStyle.value.strokeOpacity)
        }
      }

      if (styleType.value === 'categorical') {
        const field = categoricalStyle.value.field
        const cases = []
        
        categoricalStyle.value.values.forEach(valueStyle => {
          cases.push(['==', ['get', field], valueStyle.value])
          cases.push(valueStyle.color)
        })
        
        cases.push('#cccccc') // Default color
        
        return {
          ...baseStyle,
          'fill-color': ['case', ...cases],
          'fill-opacity': 0.7
        }
      }

      if (styleType.value === 'graduated') {
        const field = graduatedStyle.value.field
        const cases = []
        
        graduatedStyle.value.ranges.forEach(range => {
          cases.push(['all', 
            ['>=', ['get', field], range.min],
            ['<=', ['get', field], range.max]
          ])
          cases.push(range.color)
        })
        
        cases.push('#cccccc') // Default color
        
        return {
          ...baseStyle,
          'fill-color': ['case', ...cases],
          'fill-opacity': 0.7
        }
      }

      return baseStyle
    }

    const applyStyle = () => {
      const style = buildMapLibreStyle()
      emit('apply-style', {
        layerName: props.layerName,
        style,
        styleConfig: {
          type: styleType.value,
          simple: styleType.value === 'simple' ? simpleStyle.value : null,
          categorical: styleType.value === 'categorical' ? categoricalStyle.value : null,
          graduated: styleType.value === 'graduated' ? graduatedStyle.value : null
        }
      })
      closeEditor()
    }

    const resetToDefault = () => {
      styleType.value = 'simple'
      simpleStyle.value = {
        fillColor: '#1394b9',
        fillOpacity: 0.6,
        strokeColor: '#0f7a94',
        strokeWidth: 2,
        strokeOpacity: 1
      }
      categoricalStyle.value = {
        field: '',
        values: []
      }
      graduatedStyle.value = {
        field: '',
        classes: 5,
        colorScheme: 'blues',
        ranges: []
      }
    }

    const closeEditor = () => {
      emit('close')
    }

    const handleOverlayClick = (event) => {
      if (event.target === event.currentTarget) {
        closeEditor()
      }
    }

    // Watch for layer data changes
    watch(() => props.layerData, () => {
      if (props.layerData) {
        extractFields()
      }
    }, { immediate: true })

    return {
      styleType,
      availableFields,
      numericFields,
      uniqueValues,
      simpleStyle,
      categoricalStyle,
      graduatedStyle,
      isValidStyle,
      updateCategoricalValues,
      updateGraduatedRanges,
      updateGraduatedColors,
      getValueCount,
      formatRange,
      applyStyle,
      resetToDefault,
      closeEditor,
      handleOverlayClick
    }
  }
}
</script>

<style scoped>
.style-editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  box-sizing: border-box;
}

.style-editor-modal {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.style-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #eee;
  background: #1394b9;
  color: white;
}

.style-editor-header h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  transition: background 0.2s;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.style-editor-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.style-section {
  margin-bottom: 2rem;
}

.style-section h4 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.1rem;
  font-weight: 600;
}

.style-section h5 {
  margin: 1rem 0 0.5rem 0;
  color: #555;
  font-size: 1rem;
  font-weight: 600;
}

.style-type-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.style-tab {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  background: #f8f9fa;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.style-tab:hover {
  background: #e9ecef;
}

.style-tab.active {
  background: #1394b9;
  color: white;
  border-color: #1394b9;
}

.style-controls, .control-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.control-group {
  margin-bottom: 1rem;
}

.control-group label {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.5rem;
}

.color-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-picker {
  width: 50px;
  height: 40px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
}

.color-picker.small {
  width: 40px;
  height: 30px;
}

.color-value {
  font-family: monospace;
  font-size: 0.9rem;
  color: #666;
}

.slider {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #ddd;
  outline: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #1394b9;
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #1394b9;
  cursor: pointer;
  border: none;
}

.slider.small {
  width: 80px;
}

.field-select, .number-input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
}

.number-input {
  width: 100px;
}

.value {
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
}

.categorical-values, .graduated-ranges {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 1rem;
}

.value-style-item, .range-item {
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  background: #f8f9fa;
}

.value-header, .range-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.value-name, .range-label {
  font-weight: 500;
  color: #333;
}

.value-count, .range-count {
  font-size: 0.85rem;
  color: #666;
}

.value-controls, .range-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.color-control, .opacity-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-control label, .opacity-control label {
  font-size: 0.85rem;
  margin: 0;
}

.style-editor-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #eee;
  background: #f8f9fa;
}

.reset-button, .apply-button {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-button {
  background: #6c757d;
  color: white;
}

.reset-button:hover {
  background: #5a6268;
}

.apply-button {
  background: #1394b9;
  color: white;
}

.apply-button:hover:not(:disabled) {
  background: #0f7a94;
}

.apply-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .style-editor-modal {
    max-width: 95%;
    max-height: 95vh;
  }
  
  .style-type-tabs {
    flex-direction: column;
  }
  
  .value-controls, .range-controls {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>