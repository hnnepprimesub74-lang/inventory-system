'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {

  const router = useRouter()

  const [userEmail,
  setUserEmail] =
    useState('')

  useEffect(() => {

    checkUser()

  }, [])

  async function checkUser() {

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {

      router.push('/login')
      return

    }

    setUserEmail(
      user.email || ''
    )

  }

  async function logout() {

    await supabase.auth.signOut()

    router.push('/login')

  }

  return (

    <div className="min-h-screen bg-gray-100 p-6 text-black">

      <div className="max-w-7xl mx-auto">

        {/* HEADER */}

        <div className="bg-white rounded-3xl shadow-xl p-6 mb-8 flex flex-col lg:flex-row items-center justify-between gap-6">

          <div>

            <h1 className="text-5xl font-bold">

              Cloud Inventory ERP

            </h1>

            <p className="text-xl mt-2 text-gray-600">

              Professional Inventory Management System

            </p>

          </div>

          <div className="flex items-center gap-4">

            <div className="bg-gray-100 px-5 py-3 rounded-2xl font-semibold">

              {userEmail}

            </div>

            <button
              onClick={logout}
              className="bg-red-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-red-700 transition"
            >

              Logout

            </button>

          </div>

        </div>

        {/* DASHBOARD CARDS */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* ADD STOCK */}

          <Link
            href="/dashboard/add-stock"
            className="bg-blue-600 text-white rounded-3xl p-12 shadow-2xl hover:scale-105 transition duration-300"
          >

            <div className="text-center">

              <div className="text-7xl mb-6">

                📦

              </div>

              <h2 className="text-4xl font-bold">

                ADD STOCK

              </h2>

              <p className="mt-4 text-lg">

                Add new inventory,
                update stock,
                scan barcode,
                update cost price

              </p>

            </div>

          </Link>

          {/* SALE */}

          <Link
            href="/dashboard/sale"
            className="bg-red-600 text-white rounded-3xl p-12 shadow-2xl hover:scale-105 transition duration-300"
          >

            <div className="text-center">

              <div className="text-7xl mb-6">

                🛒

              </div>

              <h2 className="text-4xl font-bold">

                SALE

              </h2>

              <p className="mt-4 text-lg">

                Fast POS billing,
                barcode scan,
                reduce stock,
                customer checkout

              </p>

            </div>

          </Link>

          {/* RETURN */}

          <Link
            href="/dashboard/return"
            className="bg-green-600 text-white rounded-3xl p-12 shadow-2xl hover:scale-105 transition duration-300"
          >

            <div className="text-center">

              <div className="text-7xl mb-6">

                ↩️

              </div>

              <h2 className="text-4xl font-bold">

                RETURN

              </h2>

              <p className="mt-4 text-lg">

                Return products,
                increase stock,
                scan barcode,
                manage returned items

              </p>

            </div>

          </Link>

        </div>

        {/* QUICK ACCESS */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">

          <Link
            href="/products"
            className="bg-white rounded-3xl p-8 shadow hover:shadow-xl transition"
          >

            <h2 className="text-3xl font-bold">

              Inventory Products

            </h2>

            <p className="mt-3 text-gray-600">

              View all products,
              edit items,
              search inventory,
              export excel

            </p>

          </Link>

          <Link
            href="/analytics"
            className="bg-white rounded-3xl p-8 shadow hover:shadow-xl transition"
          >

            <h2 className="text-3xl font-bold">

              Analytics

            </h2>

            <p className="mt-3 text-gray-600">

              Low stock alerts,
              top selling products,
              inventory value,
              reports

            </p>

          </Link>

          <Link
            href="/settings"
            className="bg-white rounded-3xl p-8 shadow hover:shadow-xl transition"
          >

            <h2 className="text-3xl font-bold">

              Settings

            </h2>

            <p className="mt-3 text-gray-600">

              User settings,
              system settings,
              categories,
              backup

            </p>

          </Link>

        </div>

      </div>

    </div>

  )

}