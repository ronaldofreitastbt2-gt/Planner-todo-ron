import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from 'react'

type FabHandler = (() => void) | null

interface FabStore {
  subscribe: (cb: () => void) => () => void
  getHandler: () => FabHandler
  setHandler: (h: FabHandler) => void
}

const FabContext = createContext<FabStore | null>(null)

export function FabProvider({ children }: { children: React.ReactNode }) {
  const stateRef = useRef<{
    handler: FabHandler
    listeners: Set<() => void>
  }>({ handler: null, listeners: new Set() })

  const subscribe = useCallback((cb: () => void) => {
    stateRef.current.listeners.add(cb)
    return () => {
      stateRef.current.listeners.delete(cb)
    }
  }, [])

  const getHandler = useCallback(() => stateRef.current.handler, [])

  const setHandler = useCallback((h: FabHandler) => {
    stateRef.current.handler = h
    stateRef.current.listeners.forEach((cb) => cb())
  }, [])

  const storeRef = useRef<FabStore>({ subscribe, getHandler, setHandler })
  storeRef.current = { subscribe, getHandler, setHandler }

  return (
    <FabContext.Provider value={storeRef.current}>
      {children}
    </FabContext.Provider>
  )
}

/** Pages call this to register their FAB action. Clears on unmount. */
export function useRegisterFab(handler: () => void) {
  const store = useContext(FabContext)
  if (!store) throw new Error('useRegisterFab must be used inside <FabProvider>')
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    store.setHandler(() => handlerRef.current())
    return () => store.setHandler(null)
  }, [])
}

/** AppShell reads this to know whether to show the FAB and what it does. */
export function useFabHandler(): FabHandler {
  const store = useContext(FabContext)
  if (!store) return null
  return useSyncExternalStore(
    store.subscribe,
    store.getHandler,
  )
}
