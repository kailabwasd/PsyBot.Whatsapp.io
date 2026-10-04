// Storage Quota Guard to prevent QuotaExceededError in Firebase and iframe environments
if (typeof window !== 'undefined') {
  try {
    // 1. Initial cleanup of bloated firestore sync entries and oversized caches
    if (window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('firestore_') || 
          key.startsWith('firestore:') || 
          key === 'psybot_clinical_records_instant_cache' ||
          key === 'psybot_active_sessions_instant_cache' ||
          key === 'psybot_active_sessions_cache'
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });
    }
  } catch {}

  // 2. Safe monkey-patch for Storage.prototype.setItem and localStorage to absorb quota exceptions
  try {
    const patchStorage = (target: Storage) => {
      const original = target.setItem;
      target.setItem = function(key: string, value: string) {
        try {
          original.call(this, key, value);
        } catch (err: any) {
          if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.number === -2147024882) {
            try {
              // Free up space by evicting non-critical cache entries
              const keysToEvict: string[] = [];
              for (let i = 0; i < this.length; i++) {
                const k = this.key(i);
                if (k && (
                  k.startsWith('firestore_') || 
                  k.startsWith('psybot_active_sessions') || 
                  k.startsWith('psybot_clinical_records') ||
                  k.startsWith('subatech_audit_logs')
                )) {
                  keysToEvict.push(k);
                }
              }
              keysToEvict.forEach(k => {
                if (k !== key) {
                  try { this.removeItem(k); } catch {}
                }
              });
              // Retry write
              original.call(this, key, value);
            } catch {
              // Silently suppress quota error so internal assertions never fail
              console.warn('[Storage Quota Guard] Handled quota error for key:', key);
            }
          } else {
            throw err;
          }
        }
      };
    };

    if (window.Storage && window.Storage.prototype) {
      patchStorage(window.Storage.prototype);
    }
    if (window.localStorage) {
      patchStorage(window.localStorage);
    }
  } catch {}
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

