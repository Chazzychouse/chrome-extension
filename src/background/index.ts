/// <reference types="chrome" />

// Background script for Chrome Extension

// Example of listening for browser events
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  
  // Initialize storage with default values if needed
  chrome.storage.local.set({ 
    settings: {
      enableFeature: true,
      theme: 'light'
    } 
  });
});

// Example of handling messages from content scripts or popup
chrome.runtime.onMessage.addListener((
  message: { type: string; url?: string }, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response: any) => void
) => {
  console.log('Received message:', message);
  
  if (message.type === 'GET_DATA' && message.url) {
    // Example of making a web request from background script
    fetch(message.url)
      .then(response => response.json())
      .then(data => {
        console.log('Fetched data:', data);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('Fetch error:', error);
        sendResponse({ success: false, error: (error as Error).message });
      });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
}); 