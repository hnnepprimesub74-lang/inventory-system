'use client'

import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'

function Icon({ name }: { name: string }) {

  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    className: 'w-5 h-5',
  }

  switch (name) {

    case 'home':
      return (
        <svg {...common}>
          <path d="M3 11l9-7 9 7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )

    case 'box':
      return (
        <svg {...common}>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" strokeLinejoin="round" />
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" strokeLinejoin="round" />
        </svg>
      )

    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
          <path d="M15.5 5.2a3.2 3.2 0 0 1 0 6.1M21 20c0-2.8-2-5.1-4.7-5.8" strokeLinecap="round" />
        </svg>
      )

    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" />
        </svg>
      )

    case 'alert':
      return (
        <svg {...common}>
          <path d="M10.3 3.9L2.5 18a1 1 0 0 0 .9 1.5h17.2a1 1 0 0 0 .9-1.5L13.7 3.9a1 1 0 0 0-1.8 0z" strokeLinejoin="round" />
          <path d="M12 9v4" strokeLinecap="round" />
          <path d="M12 17h.01" strokeLinecap="round" />
        </svg>
      )

    case 'trending':
      return (
        <svg {...common}>
          <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 7h6v6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )

    case 'badge':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <circle cx="12" cy="11" r="2.5" />
          <path d="M8 17.5c.7-1.6 2.2-2.5 4-2.5s3.3.9 4 2.5" strokeLinecap="round" />
          <path d="M9 3v2M15 3v2" strokeLinecap="round" />
        </svg>
      )

    case 'refund':
      return (
        <svg {...common}>
          <path d="M9 14l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 10h9a5 5 0 0 1 5 5v1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )

    case 'building':
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="1" />
          <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" strokeLinecap="round" />
          <path d="M10 21v-4h4v4" />
        </svg>
      )

    case 'wallet':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18" />
          <circle cx="16" cy="14" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      )

    case 'receipt':
      return (
        <svg {...common}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" strokeLinejoin="round" />
          <path d="M9 8h6M9 12h6" strokeLinecap="round" />
        </svg>
      )

    case 'grid':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      )

    case 'report':
      return (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6V3z" strokeLinejoin="round" />
          <path d="M15 3v3h3" strokeLinejoin="round" />
          <path d="M9 13l2-2 2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )

    case 'logout':
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )

    default:
      return null

  }

}

const NAV_SECTIONS = [
  {
    title: 'Inventory',
    items: [
      { label: 'Home', href: '/', icon: 'home', isActive: (p: string) => p === '/' },
      { label: 'Stock Log', href: '/stock-log', icon: 'box', isActive: (p: string) => p === '/stock-log' },
      { label: 'Low Stock', href: '/low-stock', icon: 'alert', isActive: (p: string) => p === '/low-stock' },
      { label: 'Most Selling', href: '/most-selling', icon: 'trending', isActive: (p: string) => p === '/most-selling' },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        label: 'Supplier',
        href: '/accounting',
        icon: 'users',
        isActive: (p: string) =>
          p === '/accounting' ||
          (p.startsWith('/accounting/') && !p.startsWith('/accounting/lifetime-purchase')),
      },
      {
        label: 'Lifetime Purchase',
        href: '/accounting/lifetime-purchase',
        icon: 'chart',
        isActive: (p: string) => p.startsWith('/accounting/lifetime-purchase'),
      },
      {
        label: 'Staff',
        href: '/staff',
        icon: 'badge',
        isActive: (p: string) => p === '/staff' || p.startsWith('/staff/'),
      },
      {
        label: 'Rent',
        href: '/rent',
        icon: 'building',
        isActive: (p: string) => p === '/rent',
      },
      {
        label: 'Admin Finance',
        href: '/admin-finance',
        icon: 'badge',
        isActive: (p: string) => p === '/admin-finance',
      },
      {
        label: 'Refunds',
        href: '/refunds',
        icon: 'refund',
        isActive: (p: string) => p === '/refunds',
      },
      {
        label: 'Daraz Cash In',
        href: '/daraz',
        icon: 'wallet',
        isActive: (p: string) => p === '/daraz',
      },
      {
        label: 'Operating Expenses',
        href: '/expenses',
        icon: 'receipt',
        isActive: (p: string) => p === '/expenses',
      },
      {
        label: 'Misc Expenses',
        href: '/misc-expenses',
        icon: 'grid',
        isActive: (p: string) => p === '/misc-expenses',
      },
      {
        label: 'Loan',
        href: '/loan',
        icon: 'wallet',
        isActive: (p: string) => p === '/loan',
      },
      {
        label: 'Finance Report',
        href: '/finance-report',
        icon: 'report',
        isActive: (p: string) => p === '/finance-report',
      },
    ],
  },
]

const WORKER_ALLOWED_HREFS = ['/', '/stock-log', '/low-stock', '/most-selling']

export default function Sidebar({
  userEmail,
  totalInventoryCost,
  isViewer = false,
  role = null,
  mobileOpen = false,
  onClose,
}: {
  userEmail: string
  totalInventoryCost: number
  isViewer?: boolean
  role?: string | null
  mobileOpen?: boolean
  onClose?: () => void
}) {

  const router = useRouter()
  const pathname = usePathname()

  const visibleNavSections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items:
        role === 'worker'
          ? section.items.filter((link) => WORKER_ALLOWED_HREFS.includes(link.href))
          : section.items,
    }))
    .filter((section) => section.items.length > 0)

  function go(href: string) {

    router.push(href)
    onClose?.()

  }

  return (

    <>

      {mobileOpen && (

        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />

      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl p-5 flex flex-col gap-3 transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto lg:w-64 lg:max-w-none lg:flex-shrink-0 lg:rounded-[28px] lg:shadow-sm lg:border lg:border-zinc-200 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)]`}
      >

        <div className="flex items-center justify-between gap-3 flex-shrink-0">

          <div
            onClick={() => go('/')}
            className="flex items-center gap-3 cursor-pointer min-w-0"
          >

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-200">

              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <ellipse cx="12" cy="5" rx="8" ry="3" />
                <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
                <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
              </svg>

            </div>

            <div className="min-w-0">

              <p className="font-bold text-zinc-900 leading-tight truncate">Cloud Inventory</p>
              <p className="text-xs text-zinc-400 leading-tight">ERP System</p>
              <p className="text-[10px] font-bold text-indigo-600 leading-tight mt-0.5">Developed By Kumar</p>

            </div>

          </div>

          <button
            onClick={onClose}
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 flex-shrink-0"
            aria-label="Close menu"
          >

            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>

          </button>

        </div>

        <nav className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">

          {visibleNavSections.map((section) => (

            <div key={section.title} className="flex flex-col gap-1">

              <p className="px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                {section.title}
              </p>

              {section.items.map((link) => {

                const active = link.isActive(pathname)

                return (

                  <button
                    key={link.href}
                    onClick={() => go(link.href)}
                    className={
                      active
                        ? 'relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-50 to-fuchsia-50 text-indigo-700'
                        : 'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 transition-colors'
                    }
                  >

                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-fuchsia-500" />
                    )}

                    <span className={active ? 'text-indigo-600' : 'text-zinc-400'}>
                      <Icon name={link.icon} />
                    </span>

                    {link.label}

                  </button>

                )

              })}

            </div>

          ))}

        </nav>

      <div className="flex-shrink-0 space-y-3">

        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-50 border border-green-100 rounded-2xl px-4 py-3">

          <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-green-600" />

          <p className="text-xs text-zinc-500">Total Inventory Cost</p>
          <p className="text-lg font-bold tabular-nums text-green-600 mt-0.5">
            Rs. {totalInventoryCost.toLocaleString('en-IN')}
          </p>

        </div>

        <div className="flex items-center gap-2 px-1">

          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center text-xs font-bold uppercase flex-shrink-0">

            {userEmail.charAt(0) || '?'}

          </div>

          <div className="min-w-0">

            <p className="text-sm text-zinc-600 truncate">{userEmail}</p>

            {isViewer && (
              <span className="inline-block mt-0.5 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide">
                View Only
              </span>
            )}

          </div>

        </div>

        <button
          onClick={async () => {

            await supabase.auth.signOut()

            go('/login')

          }}
          className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors px-4 py-2.5 rounded-xl text-sm font-semibold"
        >

          <Icon name="logout" />

          Logout

        </button>

      </div>

      </aside>

    </>

  )

}
