/// <reference types="vite/client" />
import type { FalaApi } from '../../preload'

declare global {
  // Ausente na versão web (navegador)
  interface Window {
    falacmg?: FalaApi
  }
}
