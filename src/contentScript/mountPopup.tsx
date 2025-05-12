import React from 'react';
import { createRoot } from 'react-dom/client';
import SidebarPopup from '../popup/SidebarPopup';
import { waitForElement, matchers } from '../utils/wait-for-element';

export function mountReactComponent(targetElement: Element, containerStyle: Partial<CSSStyleDeclaration> = {}) {
  try {
    const existingContainer = document.getElementById('chazzy-extension-popup-container');
    if (existingContainer) {
      existingContainer.remove();
    }
    
    const container = document.createElement('div');
    container.id = 'chazzy-extension-popup-container';
    
    Object.assign(container.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      width: '400px',
      height: '100vh',
      zIndex: '999999',
      boxShadow: '-4px 0 10px rgba(0, 0, 0, 0.2)',
      backgroundColor: '#121212',
      borderLeft: '1px solid #333',
      overflow: 'hidden',
      transition: 'width 0.3s ease-in-out, transform 0.3s ease-in-out',
      ...containerStyle
    });
    
    const shadowRoot = container.attachShadow({ mode: 'open' });
    
    const shadowContainer = document.createElement('div');
    shadowContainer.id = 'shadow-container';
    shadowContainer.style.width = '100%';
    shadowContainer.style.height = '100%';
    shadowRoot.appendChild(shadowContainer);
    
    document.body.appendChild(container);
    
    const style = document.createElement('style');
    
    fetch(chrome.runtime.getURL('sidebar.css'))
      .then(response => response.text())
      .then(css => {
        style.textContent = css;
        shadowRoot.appendChild(style);
      })
      .catch(() => {
      });
    
    container.addEventListener('toggle-collapse', (event: any) => {
      const { collapsed } = event.detail;
      
      if (collapsed) {
        container.style.width = '40px';
        shadowContainer.classList.add('collapsed');
      } else {
        container.style.width = '400px';
        shadowContainer.classList.remove('collapsed');
      }
      
      // Force repaint to make animation smoother
      shadowContainer.offsetHeight;
    });
    
    try {
      const root = createRoot(shadowContainer);
      root.render(
        <React.StrictMode>
          <SidebarPopup />
        </React.StrictMode>
      );
      
      return true;
    } catch (error) {
      container.remove();
      return false;
    }
  } catch (error) {
    return false;
  }
}

export function mountPopupImmediately(containerStyle: Partial<CSSStyleDeclaration> = {}) {
  if (document.body) {
    return mountReactComponent(document.body, containerStyle);
  }
  
  // If body isn't ready yet, wait for it
  return document.addEventListener('DOMContentLoaded', () => {
    if (document.body) {
      mountReactComponent(document.body, containerStyle);
    }
  });
}

export function mountPopupOnElement(
  selector: string, 
  containerStyle: Partial<CSSStyleDeclaration> = {}
) {
  if (selector === 'body' && document.body) {
    return mountReactComponent(document.body, containerStyle);
  }
  
  return waitForElement(
    matchers.bySelector(selector),
    (element) => mountReactComponent(element, containerStyle),
    { 
      subtree: true, 
      childList: true, 
      attributes: false,
      timeout: 5000,
      onTimeout: () => {
        if (document.body) {
          mountReactComponent(document.body, containerStyle);
        }
      }
    }
  );
}

export function mountPopupBasedOnWebsite() {
  const currentUrl = window.location.href;
  
  try {
    // Option to mount immediately for all sites
    // Uncomment the next line to always mount immediately
    // return mountPopupImmediately();
    
    if (currentUrl.includes('wikipedia.org')) {
      return mountPopupOnElement('#p-logo, #p-search, .mw-logo');
    }
    
    if (currentUrl.includes('github.com')) {
      return mountPopupOnElement('a.AppHeader-user');
    }
    
    if (currentUrl.includes('hubspot.com')) {
      // Wait a bit for HubSpot to load more completely
      setTimeout(() => {
        mountPopupOnElement('.navigation-header, .global-nav-container, .nav-left, [data-selenium-id="nav-primary"]');
      }, 500);
      return true;
    }
    
    return mountPopupOnElement('a[href*="user"], a[href*="profile"]');
  } catch (error) {
    return mountPopupOnElement('body');
  }
} 