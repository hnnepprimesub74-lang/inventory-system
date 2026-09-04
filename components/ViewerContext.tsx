'use client'

import { createContext, useContext } from 'react'

type RoleContextValue = {
  isViewer: boolean
  role: string | null
}

const RoleContext = createContext<RoleContextValue>({ isViewer: false, role: null })

export function ViewerProvider({
  isViewer,
  role = null,
  children,
}: {
  isViewer: boolean
  role?: string | null
  children: React.ReactNode
}) {

  return (
    <RoleContext.Provider value={{ isViewer, role }}>
      {children}
    </RoleContext.Provider>
  )

}

export function useViewer() {
  return useContext(RoleContext).isViewer
}

export function useRole() {
  return useContext(RoleContext).role
}
