/// <reference types="vite/client" />

import type { PracticeSet } from './sets'

interface SatchelHandle {
  restart: () => void
}

declare global {
  interface Window {
    Satchel: {
      mount: (root: HTMLElement, set: PracticeSet, options?: { fresh?: boolean; heading?: string }) => SatchelHandle
      isCorrectText: (input: string, answers: string[]) => boolean
      toNumber: (s: string) => number | null
      version: number
    }
  }
}
