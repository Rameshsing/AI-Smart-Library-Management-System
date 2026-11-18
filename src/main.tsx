import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {installApiAuthInterceptor} from './utils/clientSession.ts';
import {FirebaseErrorBoundary} from './components/FirebaseErrorBoundary.tsx';

installApiAuthInterceptor();

createRoot(document.getElementById('root')!).render(
  <FirebaseErrorBoundary>
    <App />
  </FirebaseErrorBoundary>
);
