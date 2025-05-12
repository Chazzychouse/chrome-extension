/// <reference types="chrome" />
/// <reference types="react" />

import React, { useState, useEffect } from 'react';
import './Popup.css';
import { UserDTO } from '../api/models/users/UserDTO';
import { IssueDTO } from '../api/models/issues/IssueDTO';

interface PopupProps {
  isSidebar?: boolean;
}

const Popup: React.FC<PopupProps> = ({ isSidebar = false }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [user, setUser] = useState<UserDTO | null>(null);
  const [issues, setIssues] = useState<IssueDTO[] | null>(null);
  const [activeTab, setActiveTab] = useState<string>("user");
  const [extracting, setExtracting] = useState<boolean>(false);
  
  const makeApiRequest = (url: string, method = 'GET', body?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'API_REQUEST',
        url,
        method,
        body,
        requestId: Date.now().toString()
      }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response?.data);
        }
      });
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
        {submittedByUser: {iid: {type: 'Equals', values: [parseInt(user?.id || '0')]}}}
      );
      setIssues(result.values);
    } catch (err) {
      setError('Failed to load issues');
      console.error(err);
    } finally {
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
      
      if (result.values && result.values.length > 0) {
        setUser(result.values[0]);
        setActiveTab("user");
      } else {
        setError("No user found with that name");
      }
    } catch (err) {
      setError('Failed to load user data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getNameFromDom = () => {
    setExtracting(true);
    setError(null);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: 'GET_NAME_FROM_DOM' },
          (response) => {
            setExtracting(false);
            if (response?.name) {
              setName(response.name);
            } else {
              setError("Couldn't find a name on this page");
            }
          }
        );
      } else {
        setExtracting(false);
        setError("Couldn't access the active tab");
      }
    });
  };

  const parseName = (name: string) => {
    const nameParts = name.split(' ');
    return {
      firstName: nameParts[0] || '',
      lastName: nameParts[1] || ''
    };
  };

  const injectSidebar = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.id) {
        chrome.tabs.sendMessage(
          tab.id,
          { type: 'MOUNT_POPUP', selector: 'body' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message:', chrome.runtime.lastError);
              return;
            }
            
            if (response && response.success) {
              console.log('Sidebar successfully injected');
              window.close();
            } else {
              console.error('Failed to inject sidebar:', response?.error);
            }
          }
        );
      }
    } catch (error) {
      console.error('Error injecting sidebar:', error);
    }
  };

  useEffect(() => {
    if (isSidebar) {
      console.log('Rendering in sidebar mode');
    } else {
      document.body.classList.add('popup-mode');
    }
  }, [isSidebar]);

  return (
    <div className={`popup-container ${isSidebar ? 'sidebar-mode-container' : ''}`}>
      <div className="popup-header">
        <h1>Issuetrak Extension</h1>
        <button 
          className="action-button inject-button"
          onClick={injectSidebar}
          title="Open as sidebar on this page"
        >
          Open as Sidebar
        </button>
        {isSidebar && <span className="sidebar-indicator">Sidebar Mode</span>}
      </div>
      
      <div className="popup-content">
        {/* Search Section */}
        <div className="search-section">
          <button 
            className="action-button"
            onClick={getNameFromDom}
            disabled={extracting}
          >
            {extracting ? "Extracting..." : "Extract Name"}
          </button>
          
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
                <p><strong>ID:</strong> {user.iid}</p>
                <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
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
                      <h3>#{issue.iid}: {issue.subject || 'No Subject'}</h3>
                      <p>{issue.description?.substring(0, 100) || 'No description'}...</p>
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
        
        {/* Debug Data Section - Hidden by default */}
        {data && (
          <div className="card">
            <div className="card-header">Debug Data</div>
            <div className="data-display">
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Popup; 