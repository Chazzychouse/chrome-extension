/// <reference types="chrome" />

// Email extraction utility
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return Array.from(new Set(text.match(emailRegex) || []));
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    settings: {
      enableFeature: true,
      theme: 'dark'
    } 
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle email scraping
  if (request.type === 'SCRAPE_EMAILS') {
    console.log('Background script received SCRAPE_EMAILS request');
    
    // Get the active tab from the background context
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting tabs:', chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }
      
      if (!tabs || tabs.length === 0) {
        console.error('No tabs found');
        sendResponse({ error: 'No active tab found' });
        return;
      }
      
      if (!tabs[0].id) {
        console.error('Tab has no ID');
        sendResponse({ error: 'Tab has no ID' });
        return;
      }
      
      const tabId = tabs[0].id;
      console.log('Found tab ID:', tabId);
      
      // First try using chrome.scripting API (requires scripting permission)
      try {
        if (chrome.scripting && chrome.scripting.executeScript) {
          chrome.scripting.executeScript({
            target: { tabId },
            func: () => document.body.innerText
          })
          .then(results => {
            console.log('Script execution completed');
            if (!results || results.length === 0) {
              console.error('No results from script execution');
              sendResponse({ error: 'Failed to extract page content' });
              return;
            }
            
            const text = results[0].result;
            const emails = extractEmails(text);
            console.log(`Extracted ${emails.length} emails`);
            sendResponse({ emails });
          })
          .catch(error => {
            console.error('Script execution error:', error);
            // Fall back to content script messaging
            tryContentScriptApproach();
          });
        } else {
          console.log('chrome.scripting API not available, falling back to content script approach');
          tryContentScriptApproach();
        }
      } catch (error) {
        console.error('Error executing script:', error);
        // Fall back to content script messaging
        tryContentScriptApproach();
      }
      
      // Alternative approach using content script messaging
      function tryContentScriptApproach() {
        try {
          console.log('Trying content script approach');
          // Send a message to the content script to extract emails
          chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_TEXT_FOR_EMAILS' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Content script message error:', chrome.runtime.lastError);
              sendResponse({ error: 'Failed to extract emails: ' + chrome.runtime.lastError.message });
              return;
            }
            
            if (!response) {
              console.error('No response from content script');
              sendResponse({ error: 'No response from content script' });
              return;
            }
            
            if (response.error) {
              console.error('Content script returned error:', response.error);
              sendResponse({ error: response.error });
              return;
            }
            
            const text = response.text || '';
            const emails = extractEmails(text);
            console.log(`Extracted ${emails.length} emails using content script approach`);
            sendResponse({ emails });
          });
        } catch (error) {
          console.error('Error with content script approach:', error);
          sendResponse({ error: 'Failed to extract emails: ' + (error instanceof Error ? error.message : 'Unknown error') });
        }
      }
    });
    
    return true;
  }
  
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
