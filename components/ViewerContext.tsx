'use client'

import { createContext, useContext } from 'react'

const ViewerContext = createContext(false)

export function ViewerProvider({
  isViewer,
  children,
}: {
  isViewer: boolean
  children: React.ReactNode
}) {

  return (
    <ViewerContext.Provider value={isViewer}>
      {children}
    </ViewerContext.Provider>
  )

}

export function useViewer() {
  return useContext(ViewerContext)
}
