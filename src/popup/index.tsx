import { createRoot } from 'react-dom/client';
import React from 'react';
import Popup from './Popup';
import './index.css';

document.addEventListener('DOMContentLoaded', () => {
  const existingRoot = document.getElementById('root');
  const container = existingRoot || (() => {
    const div = document.createElement('div');
    div.id = 'root';
    document.body.appendChild(div);
    return div;
  })();

  console.log('Initializing popup with root element:', container);

  try {
    const root = createRoot(container);
    root.render(<Popup />);
    console.log('Popup rendered successfully');
  } catch (error) {
    console.error('Failed to render Popup:', error);
  }
}); 