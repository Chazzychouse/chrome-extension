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
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [issues, setIssues] = useState<IssueDTO[] | null>(null);
  const [activeTab, setActiveTab] = useState<string>("users");
  const [extracting, setExtracting] = useState<boolean>(false);
  const [isMainWikipediaPage, setIsMainWikipediaPage] = useState<boolean>(false);
  const [isWikipediaDomain, setIsWikipediaDomain] = useState<boolean>(false);
  const [isHubspotDomain, setIsHubspotDomain] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const arrowRef = useRef<HTMLButtonElement>(null);
  const [emailsExpanded, setEmailsExpanded] = useState(true);

  
  const pendingRequests = useRef<Record<string, (data: any, error?: string) => void>>({});
  
  useEffect(() => {
    const checkCurrentUrl = () => {
      const currentUrl = window.location.href;
      
      const isWikiDomain = /^https?:\/\/([a-z]+\.)?wikipedia\.org/.test(currentUrl);
      setIsWikipediaDomain(isWikiDomain);
      
      if (isWikiDomain) {
        const isArticlePage = /^https:\/\/[a-z]+\.wikipedia\.org\/wiki\/(?!Main_Page)([^:]+)$/.test(currentUrl);
        setIsMainWikipediaPage(isArticlePage);
      }
      
      const isHubspotPage = /^https?:\/\/([a-z]+\.)?hubspot\.com/.test(currentUrl);
      setIsHubspotDomain(isHubspotPage);
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
  
  const getIssues = async (userId: string) => {
    try {
      setLoading(true);
      setActiveTab("issues");
      setSelectedUserId(userId);
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
          setActiveTab("users");
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
            values: [parseInt(userId)]
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

  async function scrapeContent() {
    try {
      setExtracting(true);
      setError(null);
      setSelectedEmails([]);
      
      const timeoutId = setTimeout(() => {
        if (setExtracting) {
          setExtracting(false);
          setError("Email extraction timed out. Please try again.");
        }
      }, 10000);
      
      chrome.runtime.sendMessage(
        {
          type: 'SCRAPE_EMAILS'
        },
        (response) => {
          clearTimeout(timeoutId);
          setExtracting(false);
          
          if (!response) {
            setError("No response received from background script");
            return;
          }
          
          if (chrome.runtime.lastError) {
            console.error("Chrome runtime error:", chrome.runtime.lastError);
            setError("Error extracting emails: " + chrome.runtime.lastError.message);
            return;
          }

          if (response.error) {
            console.error("Error scraping emails:", response.error);
            setError("Error extracting emails: " + response.error);
            return;
          }

          setEmails(response.emails || []);
          if ((response.emails || []).length === 0) {
            setError("No email addresses found on this page");
          }
        }
      );
    } catch (error) {
      setExtracting(false);
      console.error("Error scraping content:", error);
      setError("Failed to extract emails: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  }

  const toggleEmailSelection = (email: string) => {
    setSelectedEmails(prevSelected => {
      // If already selected, remove it
      if (prevSelected.includes(email)) {
        return prevSelected.filter(e => e !== email);
      } 
      // Otherwise add it
      return [...prevSelected, email];
    });
  };

  const searchSelectedEmails = () => {
    if (selectedEmails.length === 0) {
      setError("Please select at least one email");
      return;
    }
    
    getUser({email: {type: 'MatchAny', values: selectedEmails}});
  };

  const getUser = async (filterObject: any) => {
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
        filterObject
      );
      
      if (result && result.values && result.values.length > 0) {
        setUsers(result.values);
        setActiveTab("users");
        setLoading(false);
      } else {
        setError("No users found with that criteria");
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
      }, 25);
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
    if (isHubspotDomain) {
      return (
        <div className="guidance-message card">
          <div className="card-header">HubSpot Integration</div>
          <div className="card-content">
            <p>This extension is integrated with HubSpot.</p>
            <p>You can:</p>
            <ul>
              <li>Extract emails from contact pages</li>
              <li>Search for users in the system</li>
              <li>View user details and related issues</li>
            </ul>
            <p>Try the "Extract Emails" button to find emails on this page.</p>
          </div>
        </div>
      );
    }
    
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

  const toggleEmailsSection = () => {
    setEmailsExpanded(!emailsExpanded);
  };

  useEffect(() => {
    if (users.length > 0 || issues) {
      setEmailsExpanded(false);
    }
  }, [users, issues]);

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
        {!isWikipediaDomain && !isHubspotDomain ? (
          <div className="guidance-message card">
            <div className="card-header">Domain Not Supported</div>
            <div className="card-content">
              <p>This extension works on Wikipedia and HubSpot domains.</p>
              <p>Please navigate to Wikipedia or HubSpot to use this extension.</p>
            </div>
          </div>
        ) : isWikipediaDomain && !isMainWikipediaPage ? (
          renderGuidanceMessage()
        ) : (
          <>
            {/* Search Section */}
            <div className="search-section">
              {isWikipediaDomain && !name && (
                <button 
                  className="action-button"
                  onClick={getNameFromDom}
                  disabled={extracting}
                >
                  {extracting ? "Extracting..." : "Extract Name"}
                </button>
              )}
              {emails.length <= 0 && !extracting && (
                <div className="search-row">
                  <button 
                    className="action-button"
                    onClick={scrapeContent}
                    disabled={extracting}
                  >
                    {extracting ? "Extracting Emails..." : "Extract Emails"}
                  </button>
                </div>
              )}
              {isWikipediaDomain && name && (
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
                    onClick={() => getUser({firstName: {type: 'Contains', values: [parseName(name).firstName]}, lastName: {type: 'Contains', values: [parseName(name).lastName]}})}
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
            
            {/* Email Results */}
            {emails.length > 0 && (
              <div className="emails-section">
                <div className="card">
                  <div className="card-header" onClick={toggleEmailsSection} style={{ cursor: 'pointer' }}>
                    <div className="header-content flex-row">
                      <div className="header-title-section">
                        <span className="collapse-indicator">
                          {emailsExpanded ? '▲' : '▼'}
                        </span>
                        Found Emails ({emails.length})
                        {selectedEmails.length > 0 && (
                          <span className="selected-count">
                            {selectedEmails.length} selected
                          </span>
                        )}
                        
                      </div>
                      <div className="header-actions">
                        {!emailsExpanded && selectedEmails.length > 0 && (
                          <>
                            <button 
                              className="action-button"
                              onClick={(e) => { e.stopPropagation(); searchSelectedEmails(); }}
                            >
                              Search
                            </button>
                            <button 
                              className="action-button secondary"
                              onClick={(e) => { e.stopPropagation(); setSelectedEmails([]); }}
                            >
                              Clear
                            </button>
                          </>
                        )}
                        {emailsExpanded && (
                          <button 
                            className="action-button secondary"
                            onClick={(e) => { e.stopPropagation(); setSelectedEmails(emails); }}
                          >
                            Select All
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {emailsExpanded && (
                    <>
                      <div className="emails-list">
                        {emails.map((email, index) => (
                          <div key={index} className={`email-item ${selectedEmails.includes(email) ? 'selected' : ''}`}>
                            <div className="email-text">{email}</div>
                            <div className="email-actions">
                              <button 
                                className={`action-button ${selectedEmails.includes(email) ? 'secondary' : ''}`}
                                onClick={() => toggleEmailSelection(email)}
                              >
                                {selectedEmails.includes(email) ? 'Remove' : 'Select'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedEmails.length > 0 && (
                        <div className="action-buttons">
                          <button 
                            className="action-button"
                            onClick={searchSelectedEmails}
                          >
                            Search Selected
                          </button>
                          <button 
                            className="action-button secondary"
                            onClick={() => setSelectedEmails([])}
                          >
                            Clear Selection
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* Error Message */}
            {error && <div className="error-message">{error}</div>}
            
            {/* Loading Indicator */}
            {loading && <div className="loading-spinner">Loading</div>}
            
            {/* User List Section */}
            {users.length > 0 && activeTab === "users" && (
              <div className="user-section">
                <div className="card">
                  <div className="card-header">Users Found ({users.length})</div>
                  <div className="users-list">
                    {users.map(user => (
                      <div key={user.iid} className="user-item">
                        <div className="user-details">
                          <p>
                            <strong>ID: </strong>
                            <span className="user-id">{user.id}</span>
                          </p>
                          <p>
                            <strong>Name: </strong>
                            <span className="user-name">{user.firstName} {user.lastName}</span>
                          </p>
                          {user.email && (
                            <p>
                              <strong>Email: </strong>
                              <span className="user-email">{user.email}</span>
                            </p>
                          )}
                        </div>
                        <div className="user-actions">
                          <button 
                            className="action-button"
                            onClick={() => getIssues(user.iid.toString())}
                          >
                            View Issues
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="action-buttons">
                    <button 
                      className="action-button secondary"
                      onClick={() => setUsers([])}
                    >
                      Clear All
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
                      onClick={() => setActiveTab("users")}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      Back
                    </button>
                  </div>
                  
                  {issues.length > 0 ? (
                    <div className="issues-list">
                      {issues.map(issue => (
                        <div key={issue.iid} className="issue-item">
                          <h3>#{issue.iid}: <a className="issue-link" href={`${process.env.ISSUE_LINK || ''}${issue.iid}`} target="_blank" rel="noopener noreferrer">{issue.subject || 'No Subject'}</a></h3>
                          <p className={`issue-status-${issue.isOpen ? 'open' : 'closed'}`}>
                            {issue.isOpen 
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