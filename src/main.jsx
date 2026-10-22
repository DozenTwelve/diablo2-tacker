import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './gothic-theme.css'
import './input.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Last resort, around the top bar too: whatever stored value broke the page, clearing everything stored fixes it
const forget = () => {
  try {
    localStorage.clear()
  } catch {
    // storage unavailable: nothing stored to break the page
  }
  location.reload()
}
const lang = () => {
  try {
    return JSON.parse(localStorage.getItem('lang')) ?? 'zh_tw'
  } catch {
    return 'zh_tw'
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary lang={lang()} onReset={forget}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
