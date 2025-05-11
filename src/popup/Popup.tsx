/// <reference types="chrome" />
/// <reference types="react" />

import React, { useState, useEffect } from 'react';
import './Popup.css';
import { fetchData } from '../api/api';

interface PopupProps {}

const Popup: React.FC<PopupProps> = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const result = await fetchData('https://api.example.com/data');
        setData(result);
        setError(null);
      } catch (err) {
        setError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div className="popup-container">
      <h1>Chazzy Extension</h1>
      
      {loading && <p>Loading data...</p>}
      
      {error && <p className="error">{error}</p>}
      
      {data && (
        <div className="data-container">
          <h2>Data from Web Request</h2>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}

      <button onClick={() => chrome.tabs.create({ url: 'https://example.com' })}>
        Open Example Site
      </button>
    </div>
  );
};

export default Popup; 