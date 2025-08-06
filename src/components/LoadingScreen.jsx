import React, { useEffect } from 'react';

const LoadingScreen = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem'
      }}>
        <dotlottie-wc 
          src="/animations/AeraField.json" 
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100vw',
            maxHeight: '100vh',
            objectFit: 'contain'
          }}
          speed="1" 
          autoplay 
          loop
        />
        <div style={{
          textAlign: 'center',
          color: '#ffffff'
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, #00bcd4, #26a69a)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            AeraField
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: '#b0b0b0',
            fontWeight: '400'
          }}>
            Field Navigation & Geospatial Data
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;