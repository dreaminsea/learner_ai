/// <reference types="vite/client" />

import type { LearnerAIAPI } from '../../preload/index'

declare global {
  interface Window {
    learnerAI: LearnerAIAPI
  }
}
