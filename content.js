// Captcha Reader Content Script
// Handles image processing, OCR, and clipboard operations

// Prevent multiple initializations
if (!window.captchaReaderInitialized) {
  window.captchaReaderInitialized = true;
  window.tesseractWorker = null;

  // Initialize Tesseract worker
  async function initWorker() {
    if (window.tesseractWorker) return window.tesseractWorker;
    
    // Check if Tesseract is available
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract.js not loaded');
    }
    
    // Use locally bundled worker and core to comply with MV3 remote code restrictions
    window.tesseractWorker = await Tesseract.createWorker('eng', 1, {
      workerPath: chrome.runtime.getURL('worker.min.js'),
      corePath: chrome.runtime.getURL('tesseract-core.wasm.js'),
      logger: m => console.log(m),
    });
    
    // Configure for digits only
    await window.tesseractWorker.setParameters({
      tessedit_char_whitelist: '0123456789',
    });
    
    return window.tesseractWorker;
  }

  // Show toast notification on the page
  function showToast(message, isError = false) {
    // Remove existing toast if any
    const existingToast = document.getElementById('captcha-reader-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.id = 'captcha-reader-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${isError ? '#dc3545' : '#28a745'};
      color: white;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      animation: captchaToastSlideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    
    // Add animation styles if not already added
    if (!document.getElementById('captcha-reader-styles')) {
      const style = document.createElement('style');
      style.id = 'captcha-reader-styles';
      style.textContent = `
        @keyframes captchaToastSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes captchaSpinner {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'captchaToastSlideIn 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Show loading indicator
  function showLoading() {
    const existingLoader = document.getElementById('captcha-reader-loader');
    if (existingLoader) return;
    
    const loader = document.createElement('div');
    loader.id = 'captcha-reader-loader';
    loader.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 16px 24px;
      background: #007bff;
      color: white;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: captchaSpinner 0.8s linear infinite;
    `;
    
    // Add animation styles if not already added
    if (!document.getElementById('captcha-reader-styles')) {
      const style = document.createElement('style');
      style.id = 'captcha-reader-styles';
      style.textContent = `
        @keyframes captchaSpinner {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    loader.appendChild(spinner);
    loader.appendChild(document.createTextNode('Reading captcha...'));
    document.body.appendChild(loader);
  }

  function hideLoading() {
    const loader = document.getElementById('captcha-reader-loader');
    if (loader) loader.remove();
  }

  // Preprocess image for better OCR results
  function preprocessImage(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Convert to grayscale and increase contrast
    for (let i = 0; i < data.length; i += 4) {
      // Grayscale
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      
      // Increase contrast
      const contrast = 1.5;
      const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
      const newValue = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
      
      // Apply threshold for cleaner text
      const threshold = newValue > 128 ? 255 : 0;
      
      data[i] = threshold;     // R
      data[i + 1] = threshold; // G
      data[i + 2] = threshold; // B
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  // Copy text to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers or restricted contexts
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.cssText = 'position: fixed; left: -9999px; top: -9999px;';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        return true;
      } catch (e) {
        console.error('Fallback copy failed:', e);
        return false;
      } finally {
        textArea.remove();
      }
    }
  }

  // Process the captcha image
  window.processCaptcha = async function(imageUrl) {
    showLoading();
    
    try {
      // Fetch and load the image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });
      
      // Create canvas and draw image
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Preprocess for better OCR
      preprocessImage(canvas);
      
      // Initialize Tesseract worker
      const worker = await initWorker();
      
      // Perform OCR
      const { data: { text } } = await worker.recognize(canvas);
      
      // Clean up the result - extract only digits
      const digits = text.replace(/[^0-9]/g, '').trim();
      
      hideLoading();
      
      if (digits) {
        const copied = await copyToClipboard(digits);
        if (copied) {
          showToast(`Copied: ${digits}`);
        } else {
          showToast('Failed to copy to clipboard', true);
        }
      } else {
        showToast('No numbers found in image', true);
      }
      
    } catch (error) {
      hideLoading();
      console.error('Captcha Reader error:', error);
      showToast(`Error: ${error.message}`, true);
    }
  };

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'readCaptcha') {
      window.processCaptcha(message.imageUrl);
    } else if (message.action === 'readCaptchaError') {
      showToast(message.error || 'Failed to read captcha', true);
    }
  });
}
