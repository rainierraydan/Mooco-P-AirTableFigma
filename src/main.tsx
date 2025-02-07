import React, { useEffect, useState } from "react";
import {
  dispatchTS,
  getColorTheme,
  listenTS,
  subscribeColorTheme,
} from "./utils/utils";

interface Credentials {
  airtableToken: string;
  airtableBaseId: string;
}

export const App = () => {
  const [lightOrDarkMode, setLightOrDarkMode] = useState(getColorTheme());
  const [credentials, setCredentials] = useState<Credentials>({ airtableToken: '', airtableBaseId: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    subscribeColorTheme((mode) => {
      setLightOrDarkMode(mode);
    });
  
    // Load saved credentials
    parent.postMessage({ pluginMessage: { type: 'get-credentials' } }, '*');
  
    // Add message listener
    window.onmessage = (event) => {
      const message = event.data.pluginMessage;
      if (!message) return;
  
      if (message.type === 'credentials-loaded') {
        setCredentials(message.credentials);
      } else if (message.type === 'airtable-data') {
        setLoading(false);
      } else if (message.type === 'error') {
        console.error('Error:', message.message);
        setLoading(false);
      }
    };
  }, []);
  const handleSaveCredentials = () => {
    parent.postMessage({ 
      pluginMessage: { 
        type: 'save-credentials', 
        credentials 
      }
    }, '*');
  };
  const handleUpdateContent = async () => {
    setLoading(true);
    parent.postMessage({ 
      pluginMessage: { 
        type: 'fetch-airtable-data'
      }
    }, '*');
  };
  return (
    <>
      <main className="plugin-container">
        <div className="credentials-form">
          <input
            type="text"
            placeholder="Airtable Token"
            value={credentials.airtableToken}
            onChange={(e) => {
              const newValue = e.target.value;
              setCredentials(prev => ({ ...prev, airtableToken: newValue }));
              // Auto-save credentials when they change
              parent.postMessage({ 
                pluginMessage: { 
                  type: 'save-credentials', 
                  credentials: { ...credentials, airtableToken: newValue } 
                }
              }, '*');
            }}
          />
          <input
            type="text"
            placeholder="Base ID"
            value={credentials.airtableBaseId}
            onChange={(e) => {
              const newValue = e.target.value;
              setCredentials(prev => ({ ...prev, airtableBaseId: newValue }));
              // Auto-save credentials when they change
              parent.postMessage({ 
                pluginMessage: { 
                  type: 'save-credentials', 
                  credentials: { ...credentials, airtableBaseId: newValue } 
                }
              }, '*');
            }}
          />
        </div>
        <button 
          onClick={handleUpdateContent}
          className="primary-button"
          disabled={loading}
        >
          {loading ? 'Updating...' : 'Update Content'}
        </button>
      </main>
    </>
  );
};
