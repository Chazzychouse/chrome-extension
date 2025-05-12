/// <reference types="chrome" />

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    settings: {
      enableFeature: true,
      theme: 'dark'
    } 
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'REQUEST_PERMISSION') {
    const { origins, permissions } = request;
    const permissionObj: chrome.permissions.Permissions = {};
    
    if (origins) {
      permissionObj.origins = origins;
    }
    
    if (permissions) {
      permissionObj.permissions = permissions;
    }
    
    chrome.permissions.contains(permissionObj, hasPermission => {
      if (hasPermission) {
        sendResponse({ granted: true });
      } else {
        chrome.permissions.request(permissionObj, granted => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ granted });
          }
        });
      }
    });
    
    return true;
  }
  
  if (request.type === 'API_REQUEST') {
    const { url, method, body, requestId } = request;
    
    fetch(url, {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-KEY': process.env.API_KEY || ''
      },
      body: body ? JSON.stringify(body) : undefined
    })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      try {
        const jsonData = JSON.parse(text);
        return jsonData;
      } catch (e) {
        return { rawText: text };
      }
    })
    .then(data => {
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'API_RESPONSE',
          requestId,
          data
        });
      }
      
      sendResponse({ data });
    })
    .catch(error => {
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'API_RESPONSE',
          requestId,
          error: error.message
        });
      }
      
      sendResponse({ error: error.message });
    });
    
    return true;
  }
  
  return false;
}); 
