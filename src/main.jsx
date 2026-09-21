import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './auth/AuthContext.jsx'
import App from './App.jsx'
import AppUpdates from './components/AppUpdates.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { I18nProvider } from './i18n/I18nContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <ErrorBoundary>
        <AuthProvider><App /><AppUpdates /></AuthProvider>
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>,
)
