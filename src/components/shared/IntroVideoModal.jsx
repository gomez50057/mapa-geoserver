'use client';

import { useState, useEffect } from 'react';

const IntroVideoModal = () => {
  const [isVisible, setIsVisible] = useState(true);

  const handleSkip = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    // Mostrar el video solo cuando la página cargue
    setIsVisible(true);
  }, []);

  if (!isVisible) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <video style={styles.video} controls autoPlay>
          <source src="/video/tutorial.mp4" type="video/mp4" />
          Tu navegador no soporta la reproducción de videos.
        </video>
        <button style={styles.skipButton} onClick={handleSkip}>
          Omitir
        </button>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modal: {
    position: 'relative',
    background: '#fff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  },
  video: {
    width: '75vw',
    height: 'auto',
    borderRadius: '8px',
  },
  skipButton: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    padding: '8px 12px',
    backgroundColor: '#ff4d4d',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default IntroVideoModal;
