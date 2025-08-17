<template>
  <div v-if="visible" class="symbology-modal-overlay" @click.self="onCancel">
    <div class="symbology-modal">
      <div class="modal-header">
        <h3>Layer Symbology</h3>
        <button @click="onCancel" class="close-button">×</button>
      </div>
      
      <div class="modal-content">
        <div class="layer-info">
          <h4>{{ layerName }}</h4>
          <p class="layer-type">Categorical Color Symbology</p>
        </div>

        <div class="field-selection">
          <label for="field-select">Select Field for Categories:</label>
          <select 
            id="field-select" 
            v-model="selectedField" 
            @change="onFieldChange"
            class="field-dropdown"
          >
            <option value="">Choose a field...</option>
            <option v-for="field in availableFields" :key="field" :value="field">
              {{ field }}
            </option>
          </select>
        </div>

        <div v-if="categories.length > 0" class="categories-section">
          <h5>Categories ({{ categories.length }})</h5>
          <div class="categories-list">
            <div 
              v-for="category in categories" 
              :key="category.value"
              class="category-item"
            >
              <div class="category-info">
                <span class="category-name">{{ category.value || '(empty)' }}</span>
                <span class="category-count">({{ category.count }} features)</span>
              </div>
              <div class="category-color">
                <input 
                  type="color" 
                  v-model="category.color" 
                  class="color-picker"
                  :title="`Color for ${category.value}`"
                />
                <div 
                  class="color-preview" 
                  :style="{ backgroundColor: category.color }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="selectedField" class="no-categories">
          <p>No categories found for field "{{ selectedField }}"</p>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="onCancel" class="cancel-button">Cancel</button>
        <button 
          @click="onApply" 
          :disabled="!selectedField || categories.length === 0"
          class="apply-button"
        >
          Apply
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'

export default {
  name: 'SymbologyEditor',
  props: {
    visible: {
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
  emits: ['close', 'apply'],
  setup(props, { emit }) {
    const selectedField = ref('')
    const categories = ref([])
    
    // Generate distinct colors for categories
    const generateDistinctColors = (count) => {
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#85CDCA', '#A9CCE3',
        '#D7BDE2', '#A3E4D7', '#F9E79F', '#FADBD8', '#D5DBDB'
      ]
      
      const result = []
      for (let i = 0; i < count; i++) {
        if (i < colors.length) {
          result.push(colors[i])
        } else {
          // Generate random colors for additional categories
          const hue = (i * 137.508) % 360
          result.push(`hsl(${hue}, 70%, 60%)`)
        }
      }
      return result
    }

    // Extract available fields from layer data
    const availableFields = computed(() => {
      if (!props.layerData || !props.layerData.features || props.layerData.features.length === 0) {
        return []
      }

      const fields = new Set()
      props.layerData.features.forEach(feature => {
        if (feature.properties) {
          Object.keys(feature.properties).forEach(key => {
            fields.add(key)
          })
        }
      })
      
      return Array.from(fields).sort()
    })

    // Extract unique categories from selected field
    const extractCategories = (fieldName) => {
      if (!props.layerData || !fieldName) return []

      const categoryMap = new Map()
      
      props.layerData.features.forEach(feature => {
        const value = feature.properties?.[fieldName]
        const key = value !== undefined && value !== null ? String(value) : ''
        
        if (categoryMap.has(key)) {
          categoryMap.set(key, categoryMap.get(key) + 1)
        } else {
          categoryMap.set(key, 1)
        }
      })

      const categoryList = Array.from(categoryMap.entries()).map(([value, count]) => ({
        value,
        count,
        color: '#20b2aa' // Default color
      }))

      // Sort by count (descending) then by value
      categoryList.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        return a.value.localeCompare(b.value)
      })

      // Assign distinct colors
      const colors = generateDistinctColors(categoryList.length)
      categoryList.forEach((category, index) => {
        category.color = colors[index]
      })

      return categoryList
    }

    const onFieldChange = () => {
      categories.value = extractCategories(selectedField.value)
    }

    const onApply = () => {
      if (!selectedField.value || categories.value.length === 0) return
      
      const symbologyData = {
        field: selectedField.value,
        categories: categories.value.map(cat => ({
          value: cat.value,
          color: cat.color,
          count: cat.count
        }))
      }
      
      emit('apply', symbologyData)
    }

    const onCancel = () => {
      emit('close')
    }

    // Reset when modal becomes visible
    watch(() => props.visible, (newVisible) => {
      if (newVisible) {
        selectedField.value = ''
        categories.value = []
      }
    })

    return {
      selectedField,
      categories,
      availableFields,
      onFieldChange,
      onApply,
      onCancel
    }
  }
}
</script>

<style scoped>
.symbology-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  box-sizing: border-box;
}

.symbology-modal {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
}

.modal-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.3rem;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-button:hover {
  background: rgba(0, 0, 0, 0.1);
}

.modal-content {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.layer-info h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.1rem;
}

.layer-type {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.field-selection {
  margin-bottom: 1.5rem;
}

.field-selection label {
  display: block;
  margin-bottom: 0.5rem;
  color: #333;
  font-weight: 500;
}

.field-dropdown {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  color: #333;
  transition: border-color 0.2s;
}

.field-dropdown:focus {
  outline: none;
  border-color: #20b2aa;
}

.categories-section h5 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1rem;
}

.categories-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.category-item:last-child {
  border-bottom: none;
}

.category-item:hover {
  background: #f8f9fa;
}

.category-info {
  flex: 1;
  min-width: 0;
}

.category-name {
  display: block;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-count {
  display: block;
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.25rem;
}

.category-color {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-picker {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  padding: 0;
  background: none;
}

.color-preview {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 2px solid #e0e0e0;
}

.no-categories {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  background: #f8f9fa;
}

.cancel-button,
.apply-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-button {
  background: #e0e0e0;
  color: #333;
}

.cancel-button:hover {
  background: #d0d0d0;
}

.apply-button {
  background: #20b2aa;
  color: white;
}

.apply-button:hover:not(:disabled) {
  background: #1a9a93;
}

.apply-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .symbology-modal {
    margin: 0;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
  
  .modal-footer {
    flex-direction: column-reverse;
  }
  
  .cancel-button,
  .apply-button {
    width: 100%;
  }
}
</style>