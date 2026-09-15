import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initBackendUrl } from './api/client'
import App from './App'
import './index.css'

initBackendUrl().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
