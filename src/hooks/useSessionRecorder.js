import { useEffect, useState, useSyncExternalStore } from 'react'
import { elapsedSeconds, getRecorderState, subscribeRecorder } from '../lib/sessionRecorder.js'

// The shared recorder's state, plus its running time (ticking once a
// second while it records).
export function useSessionRecorder() {
  const state = useSyncExternalStore(subscribeRecorder, getRecorderState)
  const [, tick] = useState(0)
  useEffect(() => {
    if (state.status !== 'recording') return undefined
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [state.status])
  return { ...state, seconds: elapsedSeconds(state) }
}
