/// <reference types="chrome" />

// Content script for Chrome Extension
console.log('Chazzy Extension content script loaded');

// Example of content script functionality - observe DOM changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      console.log('DOM changed:', mutation);
      // You could process the page content here
    }
  });
});

// Start observing the document with the configured parameters
observer.observe(document.body, { childList: true, subtree: true });

// Example of sending message to background script
function fetchDataFromBackground(url: string): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'GET_DATA', url },
      (response: { success: boolean; data?: any; error?: string }) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        
        if (response && response.success) {
          resolve(response.data);
        } else {
          reject(response?.error || 'Unknown error');
        }
      }
    );
  });
}

// Example usage
// fetchDataFromBackground('https://api.example.com/data')
//   .then(data => console.log('Data received in content script:', data))
//   .catch(error => console.error('Error in content script:', error)); 