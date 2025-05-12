/// <reference types="chrome" />
import { mountPopupBasedOnWebsite, mountPopupOnElement } from './mountPopup';

setTimeout(() => {
  mountPopupBasedOnWebsite();
}, 1000);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_NAME_FROM_DOM') {
    const firstHeading = document.getElementById('firstHeading');
    const span = firstHeading?.querySelector('span');
    sendResponse({ name: span?.textContent || '' });
    return true;
  }
  
  if (request.type === 'MOUNT_POPUP' && request.selector) {
    try {
      mountPopupOnElement(request.selector);
      sendResponse({ success: true });
    } catch (error: unknown) {
      sendResponse({ success: false, error: String(error) });
    }
    return true;
  }
  
  if (request.type === 'EXTRACT_TEXT_FOR_EMAILS') {
    try {
      // Get text content from the entire document
      const text = document.body.innerText || '';
      sendResponse({ text });
    } catch (error) {
      console.error('Error extracting text from page:', error);
      sendResponse({ error: 'Failed to extract text from page: ' + (error instanceof Error ? error.message : 'Unknown error') });
    }
    return true;
  }
  
  if (request.type === 'API_RESPONSE') {
    const container = document.getElementById('chazzy-extension-popup-container');
    if (container) {
      if (container.shadowRoot) {
        const shadowContainer = container.shadowRoot.getElementById('shadow-container');
        if (shadowContainer) {
          const event = new CustomEvent('api-response', { 
            detail: { 
              requestId: request.requestId,
              data: request.data,
              error: request.error
            },
            bubbles: true,
            composed: true
          });
          shadowContainer.dispatchEvent(event);
        } else {
          const event = new CustomEvent('api-response', { 
            detail: { 
              requestId: request.requestId,
              data: request.data,
              error: request.error
            } 
          });
          container.dispatchEvent(event);
        }
      } else {
        const event = new CustomEvent('api-response', { 
          detail: { 
            requestId: request.requestId,
            data: request.data,
            error: request.error
          } 
        });
        container.dispatchEvent(event);
      }
      sendResponse({ received: true });
    } else {
      sendResponse({ received: false, error: 'Container not found' });
    }
    return true;
  }
  
  return true;
}); 