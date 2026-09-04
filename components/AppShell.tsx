'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'
import Sidebar from './Sidebar'
import { ViewerProvider } from './ViewerContext'

export default function AppShell({ children }: { children: React.ReactNode }) {

  const pathname = usePathname()

  const [userEmail, setUserEmail] = useState('')
  const [totalInventoryCost, setTotalInventoryCost] = useState(0)
  const [isViewer, setIsViewer] = useState(false)
  const [ready, setReady] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const touchStartX = useRef<number | null>(null)

  useEffect(() => {

    async function load() {

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {

        setReady(true)
        return

      }

      setUserEmail(user.email || '')

      const { data: roleData } =
        await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()

      setIsViewer(roleData?.role === 'viewer')

      const { data: productsData } =
        await supabase.from('products').select('cost_price, current_stock')

      const total = (productsData || []).reduce(
        (sum, item: any) =>
          sum + Number(item.cost_price || 0) * Number(item.current_stock || 0),
        0
      )

      setTotalInventoryCost(total)
      setReady(true)

    }

    load()

  }, [pathname])

  useEffect(() => {

    setMobileMenuOpen(false)

  }, [pathname])

  function handleTouchStart(e: React.TouchEvent) {

    touchStartX.current = e.touches[0].clientX

  }

  function handleTouchEnd(e: React.TouchEvent) {

    if (touchStartX.current === null) return

    const deltaX = e.changedTouches[0].clientX - touchStartX.current

    if (!mobileMenuOpen && touchStartX.current < 32 && deltaX > 60) {

      setMobileMenuOpen(true)

    } else if (mobileMenuOpen && deltaX < -60) {

      setMobileMenuOpen(false)

    }

    touchStartX.current = null

  }

  if (pathname === '/login' || !ready || !userEmail) {
    return <>{children}</>
  }

  return (

    <ViewerProvider isViewer={isViewer}>

      <div
        className="min-h-screen bg-[#F1F2FB] p-4 lg:p-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-30 w-11 h-11 rounded-xl bg-white shadow-md border border-zinc-200 flex items-center justify-center text-zinc-600"
          aria-label="Open menu"
        >

          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>

        </button>

        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 items-start">

          <Sidebar
            userEmail={userEmail}
            totalInventoryCost={totalInventoryCost}
            isViewer={isViewer}
            mobileOpen={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
          />

          <main className="flex-1 min-w-0 w-full pt-14 lg:pt-0">

            {children}

          </main>

        </div>

      </div>

    </ViewerProvider>

  )

}
