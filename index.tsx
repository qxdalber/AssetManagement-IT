import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

console.log("AssetTrack IT Portal: Booting up...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("AssetTrack IT Portal: Critical Error - Root element not found!");
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("AssetTrack IT Portal: React tree mounted successfully.");
} catch (error) {
  console.error("AssetTrack IT Portal: Mount failed!", error);
}