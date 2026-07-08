import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null

// Capture the event once globally
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    window.dispatchEvent(new Event('install-available'))
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    window.dispatchEvent(new Event('install-dismissed'))
  })
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Already installed?
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true)
      return
    }

    // Already has a deferred prompt?
    if (deferredPrompt) {
      setCanInstall(true)
    }

    const onAvailable = () => setCanInstall(true)
    const onDismissed = () => {
      setCanInstall(false)
      setIsInstalled(true)
    }

    window.addEventListener('install-available', onAvailable)
    window.addEventListener('install-dismissed', onDismissed)

    return () => {
      window.removeEventListener('install-available', onAvailable)
      window.removeEventListener('install-dismissed', onDismissed)
    }
  }, [])

  async function install() {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    setCanInstall(false)
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    return outcome === 'accepted'
  }

  return { canInstall, isInstalled, install }
}
