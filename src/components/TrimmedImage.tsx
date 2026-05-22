import React, { useRef, useEffect } from 'react';

interface TrimmedImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
}

export const TrimmedImage: React.FC<TrimmedImageProps> = ({ src, alt, className, style, onLoad, onError }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // In case we serve from CDN later
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { 
        onLoad?.(); 
        return; 
      }
      
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      let top = 0, bottom = img.height - 1, left = 0, right = img.width - 1;

      let found = false;
      for (let y = 0; y < img.height; y++) {
        let count = 0;
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          // Not totally transparent and not pure white
          if (data[i+3] > 0 && (data[i] < 200 || data[i+1] < 200 || data[i+2] < 200)) {
            count++;
          }
        }
        if (count > 5) { top = y; found = true; break; }
      }

      // Find bottom
      found = false;
      for (let y = img.height - 1; y >= 0; y--) {
        let count = 0;
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          if (data[i+3] > 0 && (data[i] < 200 || data[i+1] < 200 || data[i+2] < 200)) {
            count++;
          }
        }
        if (count > 5) { bottom = y; found = true; break; }
      }

      const marginX = Math.floor(img.width * 0.08); // 8% margin
      
      // Find left
      found = false;
      for (let x = marginX; x < img.width - marginX; x++) {
        let count = 0;
        for (let y = 0; y < img.height; y++) {
          const i = (y * img.width + x) * 4;
          if (data[i+3] > 0 && (data[i] < 200 || data[i+1] < 200 || data[i+2] < 200)) {
            count++;
          }
        }
        if (count > 5) { left = x; found = true; break; }
      }

      // Find right
      found = false;
      for (let x = img.width - marginX; x >= marginX; x--) {
        let count = 0;
        for (let y = 0; y < img.height; y++) {
          const i = (y * img.width + x) * 4;
          if (data[i+3] > 0 && (data[i] < 200 || data[i+1] < 200 || data[i+2] < 200)) {
            count++;
          }
        }
        if (count > 5) { right = x; found = true; break; }
      }

      // Add small padding
      const padding = 10;
      top = Math.max(0, top - padding);
      bottom = Math.min(img.height - 1, bottom + padding);
      left = Math.max(0, left - padding);
      right = Math.min(img.width - 1, right + padding);

      const trimWidth = Math.max(1, right - left + 1);
      const trimHeight = Math.max(1, bottom - top + 1);

      const finalCanvas = canvasRef.current;
      if (finalCanvas) {
        finalCanvas.width = trimWidth;
        finalCanvas.height = trimHeight;
        const fCtx = finalCanvas.getContext('2d');
        if (fCtx) {
          // Fill background with white in case there's transparency
          fCtx.fillStyle = '#ffffff';
          fCtx.fillRect(0, 0, trimWidth, trimHeight);
          fCtx.drawImage(img, left, top, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight);
        }
      }
      onLoad?.();
    };

    img.onerror = () => {
      onError?.();
      onLoad?.(); // Ensure loading spinner stops even if image fails
    };

    img.src = src;
  }, [src, onLoad, onError]);

  // Canvas elements don't respond to object-contain or w-full like <img> does.
  // We must force scaling via inline style so it fills the container properly.
  const baseStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    height: 'auto',
    maxHeight: '50vh',
  };

  return <canvas ref={canvasRef} className={className} style={{ ...baseStyle, ...style }} aria-label={alt} />;
};
