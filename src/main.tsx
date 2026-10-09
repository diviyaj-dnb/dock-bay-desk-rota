import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import {AuthGate} from './components/AuthGate';
import {FloorPlanPreview} from './components/FloorPlanPreview';
import './index.css';

// `?preview=floorplan` renders the new-office plan on mock data, outside auth,
// so the layout can be iterated on quickly. Remove once the office is signed off.
const isFloorPlanPreview =
  new URLSearchParams(window.location.search).get('preview') === 'floorplan';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isFloorPlanPreview ? (
        <FloorPlanPreview />
      ) : (
        <AuthGate>
          <App />
        </AuthGate>
      )}
    </ErrorBoundary>
  </StrictMode>,
);
