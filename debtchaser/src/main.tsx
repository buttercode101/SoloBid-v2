import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Professional Storage Abstraction
const storage = {
  get: async (key: string) => {
    try {
      const val = localStorage.getItem(key);
      return val ? { value: val } : null;
    } catch (e) {
      console.error('Storage read error:', e);
      return null;
    }
  },
  set: async (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('Storage write error:', e);
    }
  },
  delete: async (key: string) => {
    localStorage.removeItem(key);
  },
  clear: async () => {
    localStorage.clear();
  },
};

(window as any).storage = storage;

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
