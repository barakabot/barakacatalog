'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  loginTime: number | null
  setAuthed: (v: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      loginTime: null,
      setAuthed: (v) => set({ isAuthenticated: v, loginTime: v ? Date.now() : null }),
      logout: () => set({ isAuthenticated: false, loginTime: null }),
    }),
    { name: 'baraka-auth' }
  )
)
