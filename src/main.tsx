import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { startAlarmManager } from './lib/alarm-manager'
import '../app/globals.css'

// Service Worker: in dev, unregister any old SW first (they break Vite HMR).
// In production, register the SW for offline/PWA support and check for updates.
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Aggressively remove ALL SWs in dev mode
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister())
    })
    // Em dev, iniciar alarmes direto (sem SW)
    startAlarmManager()
  } else {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Esperar o SW estar ativo antes de iniciar alarmes
      const startWhenReady = () => {
        if (navigator.serviceWorker.controller) {
          startAlarmManager()
        } else {
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            startAlarmManager()
          }, { once: true })
          // Fallback: iniciar mesmo sem SW após 3s
          setTimeout(startAlarmManager, 3000)
        }
      }
      startWhenReady()

      // Check for SW updates every 60 minutes
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)

      // When a new SW is installed, notify the user to reload
      reg.addEventListener('updatefound', () => {
        const newSw = reg.installing
        if (!newSw) return
        newSw.addEventListener('statechange', () => {
          if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
            // New content available — show a subtle prompt
            window.dispatchEvent(new CustomEvent('sw-update', { detail: { registration: reg } }))
          }
        })
      })
    }).catch(() => {
      // SW registration failed — start alarms anyway (fallback Notification API)
      startAlarmManager()
    })
  }
} else {
  startAlarmManager()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
