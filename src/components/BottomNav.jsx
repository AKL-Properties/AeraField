import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHome, faMap, faLayerGroup, faLocationDot, faCog } from '@fortawesome/free-solid-svg-icons'

const BottomNav = ({ activeTab, onTabChange, onLocateMe }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: faHome },
    { id: 'map', label: 'Map', icon: faMap },
    { id: 'layers', label: 'Layers', icon: faLayerGroup },
    { id: 'locate', label: 'GPS', icon: faLocationDot },
    { id: 'settings', label: 'Settings', icon: faCog }
  ]

  const handleTabClick = (tabId) => {
    if (tabId === 'locate') {
      onLocateMe?.()
    } else {
      onTabChange(tabId)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '80px',
      background: 'rgba(26, 26, 26, 0.95)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      padding: '0 1rem',
      zIndex: 1000,
      boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.3)'
    }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabClick(tab.id)}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === tab.id ? '#00bcd4' : '#888',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 12px',
            borderRadius: '12px',
            transition: 'all 0.3s ease',
            transform: activeTab === tab.id ? 'translateY(-2px)' : 'translateY(0)',
            minWidth: '50px'
          }}
          onTouchStart={(e) => {
            e.target.style.transform = 'translateY(1px) scale(0.95)'
          }}
          onTouchEnd={(e) => {
            e.target.style.transform = activeTab === tab.id ? 'translateY(-2px)' : 'translateY(0)'
          }}
        >
          <FontAwesomeIcon
            icon={tab.icon}
            style={{
              fontSize: '1.2rem',
              filter: activeTab === tab.id ? 'drop-shadow(0 0 8px #00bcd4)' : 'none'
            }}
          />
          <span style={{
            fontSize: '0.65rem',
            fontWeight: activeTab === tab.id ? '600' : '400',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  )
}

export default BottomNav