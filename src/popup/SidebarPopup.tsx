/// <reference types="chrome" />
/// <reference types="react" />

import React, { useState, useEffect, useRef } from 'react';
import './sidebar.css';
import { UserDTO } from '../api/models/users/UserDTO';
import { IssueDTO } from '../api/models/issues/IssueDTO';

const SidebarPopup: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [user, setUser] = useState<UserDTO | null>(null);
  const [issues, setIssues] = useState<IssueDTO[] | null>(null);
  const [activeTab, setActiveTab] = useState<string>("user");
  const [extracting, setExtracting] = useState<boolean>(false);
  const [isMainWikipediaPage, setIsMainWikipediaPage] = useState<boolean>(false);
  const [isWikipediaDomain, setIsWikipediaDomain] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const arrowRef = useRef<HTMLButtonElement>(null);

  
  const pendingRequests = useRef<Record<string, (data: any, error?: string) => void>>({});
  
  useEffect(() => {
    const checkCurrentUrl = () => {
      const currentUrl = window.location.href;
      
      const isWikiDomain = /^https?:\/\/([a-z]+\.)?wikipedia\.org/.test(currentUrl);
      setIsWikipediaDomain(isWikiDomain);
      
      if (!isWikiDomain) return;
      
      const isArticlePage = /^https:\/\/[a-z]+\.wikipedia\.org\/wiki\/(?!Main_Page)([^:]+)$/.test(currentUrl);
      setIsMainWikipediaPage(isArticlePage);
    };
    
    checkCurrentUrl();
    
    const handleUrlChange = () => {
      checkCurrentUrl();
    };
    
    const observer = new MutationObserver(handleUrlChange);
    observer.observe(document.documentElement, { 
      childList: true, 
      subtree: true 
    });
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  useEffect(() => {
    const container = document.getElementById('chazzy-extension-popup-container');
    if (!container) return;
    
    const handleApiResponse = (event: any) => {
      const { requestId, data, error } = event.detail;
      const callback = pendingRequests.current[requestId];
      if (callback) {
        callback(data, error);
        delete pendingRequests.current[requestId];
      }
    };
    
    container.addEventListener('api-response', handleApiResponse);
    
    return () => {
      container.removeEventListener('api-response', handleApiResponse);
    };
  }, []);

  const makeApiRequest = (url: string, method = 'GET', body?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      
      pendingRequests.current[requestId] = (data, error) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(data);
        }
      };
      
      try {
        chrome.runtime.sendMessage({
          type: 'API_REQUEST',
          url,
          method,
          body,
          requestId
        }, (response) => {
          if (chrome.runtime.lastError) {
            delete pendingRequests.current[requestId];
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response) {
            delete pendingRequests.current[requestId];
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.data);
            }
          }
        });
      } catch (err) {
        delete pendingRequests.current[requestId];
        reject(err);
      }
    });
  };
  
  const getIssues = async () => {
    try {
      setLoading(true);
      setActiveTab("issues");
      try {
        const permissionResult = await new Promise<boolean>((resolve, reject) => {
          chrome.runtime.sendMessage({
            type: 'REQUEST_PERMISSION',
            origins: [process.env.SITE_DOMAIN]
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            
            if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response?.granted || false);
            }
          });
        });
        
        if (!permissionResult) {
          setError('You need to grant permission to view issues');
          setLoading(false);
          setActiveTab("user");
          return;
        }
      } catch (err) {
        console.warn('Permission request failed, proceeding anyway:', err);
      }
      
      const result = await makeApiRequest(
        `${process.env.API_BASE_URL}/Issues/Search`,
        'POST',
        {submittedByUser: {
          iid: {
            type: 'MatchAny', 
            values: [parseInt(user?.id || '0')]
          }
        }}
      );
      
      if (result && result.values) {
        setIssues(result.values);
      } else {
        setIssues([]);
      }
      setLoading(false);
    } catch (err) {
      setError('Failed to load issues: ' + (err instanceof Error ? err.message : String(err)));
      setLoading(false);
    }
  }

  const getUser = async () => {
    try {
      setLoading(true);
      setError(null);
      
      try {
        const permissionResult = await new Promise<boolean>((resolve, reject) => {
          chrome.runtime.sendMessage({
            type: 'REQUEST_PERMISSION',
            origins: [process.env.SITE_DOMAIN || '']
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            
            if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response?.granted || false);
            }
          });
        });
        
        if (!permissionResult) {
          setError('You need to grant permission to search for users');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Permission request failed, proceeding anyway:', err);
      }
      
      const result = await makeApiRequest(
        `${process.env.API_BASE_URL}/Users/Search`,
        'POST',
        {firstName: {type: 'Contains', values: [parseName(name).firstName]}, lastName: {type: 'Contains', values: [parseName(name).lastName]}}
      );
      
      if (result && result.values && result.values.length > 0) {
        setUser(result.values[0]);
        setActiveTab("user");
        setLoading(false);
      } else {
        setError("No user found with that name");
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to load user data: ' + (err instanceof Error ? err.message : String(err)));
      setLoading(false);
    }
  };

  const getNameFromDom = () => {
    setExtracting(true);
    setError(null);
    
    try {
      const firstHeading = document.getElementById('firstHeading');
      const span = firstHeading?.querySelector('span');
      const nameFromDOM = span?.textContent?.trim() || '';
      
      setExtracting(false);
      if (nameFromDOM) {
        setName(nameFromDOM);
      } else {
        setError("Couldn't find a name on this page");
      }
    } catch (err) {
      setExtracting(false);
      setError("Error accessing page DOM");
    }
  };

  const parseName = (name: string) => {
    const nameParts = name.split(' ');
    return {
      firstName: nameParts[0] || '',
      lastName: nameParts[1] || ''
    };
  };
  
  useEffect(() => {
    if (isCollapsed && arrowRef.current) {
      arrowRef.current.style.position = 'fixed';
      arrowRef.current.style.left = '-15px';
      arrowRef.current.style.opacity = '1';
      arrowRef.current.style.zIndex = '9999';
    } else if (arrowRef.current) {
      arrowRef.current.style.position = '';
      arrowRef.current.style.left = '';
      arrowRef.current.style.opacity = '';
      arrowRef.current.style.zIndex = '';
    }
  }, [isCollapsed]);
  
  const handleCollapse = () => {
    const newCollapsedState = !isCollapsed;
    
    const container = document.getElementById('chazzy-extension-popup-container');
    const shadowRoot = container?.shadowRoot;
    const shadowContainer = shadowRoot?.getElementById('shadow-container');
    
    if (newCollapsedState && shadowContainer) {
      shadowContainer.classList.add('collapsing');
        
      setTimeout(() => {
        setIsCollapsed(newCollapsedState);
        if (container) {
          const event = new CustomEvent('toggle-collapse', { 
            detail: { collapsed: newCollapsedState } 
          });
          container.dispatchEvent(event);
        }
      }, 50);
    } else {
      setIsCollapsed(newCollapsedState);
      if (container) {
        const event = new CustomEvent('toggle-collapse', { 
          detail: { collapsed: newCollapsedState } 
        });
        container.dispatchEvent(event);
      }
      
      if (shadowContainer) {
        shadowContainer.classList.remove('collapsing');
      }
    }
  };

  const renderGuidanceMessage = () => {
    return (
      <div className="guidance-message card">
        <div className="card-header">Navigation Guide</div>
        <div className="card-content">
          <p>This extension works on regular <a href="https://en.wikipedia.org/wiki/Jerry_Rice" target="_blank" rel="noopener noreferrer">Wikipedia article</a> pages.</p>
          <p>Please navigate to any Wikipedia article page to use all features.</p>
          <p>The extension doesn't work on special pages (those with a colon in the URL) or the Main Page.</p>
          <p>On article pages, you can:</p>
          <ul>
            <li>Extract names automatically</li>
            <li>Search for users in the system</li>
            <li>View user details and related issues</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="popup-container">
      <button 
        ref={arrowRef}
        className="collapse-button"
        onClick={handleCollapse}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{ 
          position: isCollapsed ? 'fixed' : 'absolute',
          opacity: 1,
          zIndex: isCollapsed ? 9999 : 100,
          left: isCollapsed ? '-15px' : 0
        }}
      >
        {isCollapsed ? '◀' : '▶'}
      </button>
      
      <div className="popup-header">
        <h1>Issuetrak Extension</h1>
        <span className="sidebar-mode-label">Sidebar</span>
      </div>
      
      <div className="popup-content">
        {!isWikipediaDomain ? (
          <div className="guidance-message card">
            <div className="card-header">Wikipedia Required</div>
            <div className="card-content">
              <p>This extension only works on Wikipedia domains.</p>
              <p>Please navigate to any Wikipedia page to use this extension.</p>
            </div>
          </div>
        ) : !isMainWikipediaPage ? (
          renderGuidanceMessage()
        ) : (
          <>
            {/* Search Section */}
            <div className="search-section">
              {!name && (
                <button 
                  className="action-button"
                  onClick={getNameFromDom}
                  disabled={extracting}
                >
                  {extracting ? "Extracting..." : "Extract Name"}
                </button>
              )}
              
              {name && (
                <div className="search-row">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Name"
                    className="search-input"
                  />
                  <button 
                    className="action-button"
                    onClick={getUser}
                    disabled={loading || name.trim() === ''}
                  >
                    Search
                  </button>
                  <button 
                    className="action-button secondary"
                    onClick={() => setName("")}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            
            {/* Error Message */}
            {error && <div className="error-message">{error}</div>}
            
            {/* Loading Indicator */}
            {loading && <div className="loading-spinner">Loading</div>}
            
            {/* User Information */}
            {user && activeTab === "user" && (
              <div className="user-section">
                <div className="card">
                  <div className="card-header">User Information</div>
                  <div className="user-details">
                    <p>
                      <strong>ID:     </strong>
                      <span> {user.iid}</span>
                    </p>
                    <p>
                      <strong>Name:     </strong>
                      <span>{user.firstName} {user.lastName}</span>
                    </p>
                    {user.email && (
                      <p>
                        <strong>Email:     </strong>
                        <span>{user.email}</span>
                      </p>
                    )}
                  </div>
                  <div className="action-buttons">
                    <button 
                      className="action-button"
                      onClick={getIssues}
                    >
                      View Issues
                    </button>
                    <button 
                      className="action-button secondary"
                      onClick={() => setUser(null)}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Issues Section */}
            {issues && activeTab === "issues" && (
              <div className="issues-section">
                <div className="card">
                  <div className="card-header">
                    Issues {issues.length > 0 && `(${issues.length})`}
                    <button 
                      className="action-button secondary"
                      onClick={() => setActiveTab("user")}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      Back
                    </button>
                  </div>
                  
                  {issues.length > 0 ? (
                    <div className="issues-list">
                      {issues.map(issue => (
                        <div key={issue.iid} className="issue-item">
                          <h3>#{issue.iid}: <a href={`${process.env.ISSUE_LINK || ''}${issue.iid}`} target="_blank" rel="noopener noreferrer">{issue.subject || 'No Subject'}</a></h3>
                          <p>{issue.isOpen 
                            ? 'Open'
                            : 'Closed'}
                          </p>
                          {issue.hasOwnProperty('submittedDate') && (
                            <div className="issue-meta">
                              Submitted: {new Date((issue as any).submittedDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-issues">
                      No issues found for this user
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SidebarPopup; 