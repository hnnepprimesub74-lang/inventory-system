'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {

  const router = useRouter()

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  async function login() {

    setLoading(true)

    const { error } =
      await supabase.auth
        .signInWithPassword({
          email,
          password,
        })

    setLoading(false)

    if (error) {

      alert(error.message)
      return

    }

    router.push('/')

  }

  return (

    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 flex items-center justify-center p-6">

      <div className="w-full max-w-md">

        <div className="bg-white rounded-[35px] shadow-2xl p-10 border border-gray-200">

          <div className="text-center mb-10">

            <div className="w-24 h-24 bg-black rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-lg">

              <span className="text-white text-4xl font-bold">

                I

              </span>

            </div>

            <h1 className="text-5xl font-bold text-black">

              Inventory ERP

            </h1>

            <p className="text-gray-500 mt-4 text-lg">

              Smart Cloud Inventory System

            </p>

          </div>

          <div className="space-y-5">

            <div>

              <label className="block mb-2 font-semibold text-black">

                Email Address

              </label>

              <input
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
                className="w-full border-2 border-gray-200 focus:border-black outline-none rounded-2xl px-5 py-4 text-lg transition"
              />

            </div>

            <div>

              <label className="block mb-2 font-semibold text-black">

                Password

              </label>

              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                className="w-full border-2 border-gray-200 focus:border-black outline-none rounded-2xl px-5 py-4 text-lg transition"
              />

            </div>

            <button
              onClick={login}
              disabled={loading}
              className="w-full bg-black hover:bg-gray-900 text-white py-4 rounded-2xl font-bold text-xl transition duration-200 shadow-lg"
            >

              {loading
                ? 'Signing In...'
                : 'Login'}

            </button>

          </div>

          <div className="mt-8 text-center text-gray-500">

            Secure Staff Access

          </div>

        </div>

      </div>

    </div>

  )
}