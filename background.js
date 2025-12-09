// Create context menu item when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "readCaptcha",
    title: "Read Captcha",
    contexts: ["image"]
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "readCaptcha") {
    try {
      // First, try to inject the content scripts if they're not already there
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['tesseract.min.js']
      }).catch(() => {
        // Script might already be loaded, ignore error
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).catch(() => {
        // Script might already be loaded, ignore error
      });
      
      // Small delay to ensure scripts are loaded
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send message to content script with the image URL
      await chrome.tabs.sendMessage(tab.id, {
        action: "readCaptcha",
        imageUrl: info.srcUrl
      });
    } catch (error) {
      console.error('Error:', error);
      // Show notification about the error
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "Captcha Reader",
        message: "Failed to read captcha. Please refresh the page and try again."
      });
    }
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "showNotification") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Captcha Reader",
      message: message.text
    });
  }
});
