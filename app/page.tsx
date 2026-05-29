'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { Html5Qrcode } from "html5-qrcode"
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function Home() {

  const router = useRouter()

  const scannerRef = useRef<Html5Qrcode | null>(null)

  const scannerStartingRef = useRef(false)

  const scanInputRef = useRef<any>(null)



  const [products, setProducts] =
    useState<any[]>([])

  const [userEmail,
    setUserEmail] =
    useState('')

  const [barcode, setBarcode] =
    useState('')

  const [productName,
    setProductName] =
    useState('')

  const [category,
    setCategory] =
    useState('')

  const [costPrice,
    setCostPrice] =
    useState('')

  const [stock, setStock] =
    useState('')

  const [search, setSearch] =
    useState('')

  const [scanBarcode,
    setScanBarcode] =
    useState('')

  const [mode, setMode] =
    useState('SELL')

  const [selectedCategory,
    setSelectedCategory] =
    useState('ALL')

  const [showCamera,
    setShowCamera] =
    useState(false)

  const [showAllTopSelling,
    setShowAllTopSelling] =
    useState(false)

  const [showAllLowStock,
    setShowAllLowStock] =
    useState(false)

  const [editingProduct,
    setEditingProduct] =
    useState<any>(null)

  const [deleteId,
    setDeleteId] =
    useState<any>(null)

  const [editName,
    setEditName] =
    useState('')

  const [editCategory,
    setEditCategory] =
    useState('')

  const [editCost,
    setEditCost] =
    useState('')

  const [editStock,
    setEditStock] =
    useState('')

  const [editBarcode,
    setEditBarcode] =
    useState('')

  const [editShade,
    setEditShade] =
    useState('')

  const [editWeight,
    setEditWeight] =
    useState('')

  const [editImage,
    setEditImage] =
    useState('')





  const [imageUrl,
    setImageUrl] =
    useState('')

  const [shade,
    setShade] =
    useState('')

  const [weight,
    setWeight] =
    useState('')

  const [showAddStockModal,
    setShowAddStockModal] =
    useState(false)

  const [isNewProduct,
    setIsNewProduct] =
    useState(false)

  const [scannedBarcode,
    setScannedBarcode] =
    useState('')

  const [stockQty,
    setStockQty] =
    useState('')

  const [stockRate,
    setStockRate] =
    useState('')

  const [selectedProduct,
    setSelectedProduct] =
    useState<any>(null)






  useEffect(() => {

    checkUser()
    fetchProducts()

  }, [])

  useEffect(() => {

    if (!showCamera) {

      if (scannerRef.current) {

        scannerRef.current.stop()
          .then(() => {
            scannerRef.current = null
          })
          .catch(console.error)

      }

      return
    }

    if (
      scannerRef.current ||
      scannerStartingRef.current
    ) {
      return
    }

    scannerStartingRef.current = true

    const scanner =
      new Html5Qrcode("reader")

    scannerRef.current = scanner

    scanner.start(
      {
        facingMode: "environment"
      },
      {
        fps: 10,
        qrbox: 250
      },
      async (decodedText) => {
        setScanBarcode(decodedText)
        await handleBarcodeScan(decodedText)
      }
    )
      .then(() => {
        scannerStartingRef.current = false
      })
      .catch((err) => {
        scannerStartingRef.current = false
        console.error(err)
      })

    return () => {

      if (scannerRef.current) {

        scannerRef.current.stop()
          .catch(() => { })

        scannerRef.current = null

      }

    }

  }, [showCamera])





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

  async function fetchProducts() {

    const { data } =
      await supabase
        .from('products')
        .select('*')
        .order(
          'created_at',
          {
            ascending: false,
          }
        )

    if (data) {

      setProducts(data)

    }

  }

  async function uploadImage(
    file: any
  ) {

    const fileName =
      `${Date.now()}-${file.name}`

    const { error } =
      await supabase.storage
        .from('products')
        .upload(
          fileName,
          file
        )

    if (error) {

      alert(error.message)
      return

    }

    const {
      data
    } = supabase.storage
      .from('products')
      .getPublicUrl(
        fileName
      )

    setImageUrl(
      data.publicUrl
    )
  }


  async function addProduct() {

    if (
      !barcode ||
      !productName
    ) {

      alert(
        'Fill all details'
      )

      return

    }

    const { error } =
      await supabase
        .from('products')
        .insert([
          {
            barcode,

            product_name:
              productName,

            category,

            cost_price:
              Number(costPrice),

            current_stock:
              Number(stock),

            shade,

            weight,

            image_url:
              imageUrl,
          },
        ])

    if (error) {

      alert(error.message)
      return

    }

    alert('Product Added')

    setBarcode('')
    setProductName('')
    setCategory('')
    setCostPrice('')
    setStock('')
    setShade('')
    setWeight('')
    setImageUrl('')

    fetchProducts()

  }

  async function processReturn(
    product: any
  ) {

    await supabase
      .from('products')
      .update({
        current_stock:
          product.current_stock + 1,
      })
      .eq('id', product.id)

    fetchProducts()

  }

  async function handleBarcodeScan(
    code: string
  ) {

    const { data } =
      await supabase
        .from('products')
        .select('*')
        .eq(
          'barcode',
          code
        )
        .single()

    if (!data) {

      return

    }

    if (mode === 'ADD') {

      const existingProduct =
        products.find(
          (p) =>
            p.barcode === code
        )

      setScannedBarcode(
        code
      )

      if (existingProduct) {

        setSelectedProduct(
          existingProduct
        )

        setIsNewProduct(
          false
        )

      } else {

        setIsNewProduct(
          true
        )

      }

      setShowAddStockModal(
        true
      )

      return

    }

    if (mode === 'SELL') {

      const product =
        products.find(
          (p) =>
            p.barcode === code
        )

      if (!product) {

        alert(
          'Product not found'
        )

        return

      }

      if (
        product.current_stock <= 0
      ) {

        alert(
          'Out of stock'
        )

        return

      }

      const newStock =
        product.current_stock - 1

      await supabase
        .from('products')
        .update({

          current_stock:
            newStock,

        })
        .eq(
          'id',
          product.id
        )

      await supabase
        .from(
          'stock_transactions'
        )
        .insert([
          {

            product_id:
              product.id,

            type: 'SALE',

            quantity: 1,

          },
        ])

      fetchProducts()

      alert(
        `${product.product_name} sold`
      )

      return

    } else {

      processReturn(data)

    }

    setScanBarcode('')

  }

  async function updateProduct() {

    await supabase
      .from('products')
      .update({

        barcode:
          editBarcode,

        product_name:
          editName,

        category:
          editCategory,

        shade:
          editShade,

        weight:
          editWeight,

        cost_price:
          Number(editCost),

        current_stock:
          Number(editStock),

        image_url:
          editImage,

      })
      .eq(
        'id',
        editingProduct.id
      )

    setEditingProduct(
      null
    )

    fetchProducts()

  }

  async function deleteProduct(
    id: any
  ) {



    await supabase
      .from(
        'stock_transactions'
      )
      .delete()
      .eq(
        'product_id',
        id
      )

    const { error } =
      await supabase
        .from('products')
        .delete()
        .eq('id', id)

    if (error) {

      alert(error.message)

      return

    }

    fetchProducts()

  }





  function exportToExcel() {

    const exportData =
      filteredProducts.map(
        (product) => ({
          Barcode:
            product.barcode,

          Product:
            product.product_name,

          Category:
            product.category,

          Cost:
            product.cost_price,

          Stock:
            product.current_stock,

          Total:
            product.cost_price *
            product.current_stock,
        })
      )

    const worksheet =
      XLSX.utils.json_to_sheet(
        exportData
      )

    const workbook =
      XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Inventory'
    )

    const excelBuffer =
      XLSX.write(
        workbook,
        {
          bookType: 'xlsx',
          type: 'array',
        }
      )

    const blob = new Blob(
      [excelBuffer],
      {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
      }
    )

    saveAs(
      blob,
      'inventory.xlsx'
    )

  }

  const uniqueCategories =
    [
      ...new Set(
        products.map(
          (p) => p.category
        )
      ),
    ]

  const filteredProducts =
    products.filter(
      (product) => {

        const matchesSearch =
          product.product_name
            ?.toLowerCase()
            .includes(
              search.toLowerCase()
            ) ||
          product.barcode
            ?.includes(search)

        const matchesCategory =
          selectedCategory ===
          'ALL' ||
          product.category ===
          selectedCategory

        return (
          matchesSearch &&
          matchesCategory
        )

      }
    )

  const totalInventoryCost =
    products.reduce(
      (sum, item) =>
        sum +
        item.cost_price *
        item.current_stock,
      0
    )

  const lowStockProducts =
    products.filter(
      (p) =>
        p.current_stock <= 5
    )

  const topSellingProducts =
    [...products]
      .sort(
        (a, b) =>
          a.current_stock -
          b.current_stock
      )

  return (

    <div className="min-h-screen bg-zinc-100 p-6 text-black">

      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}

        <div className="flex flex-col lg:flex-row justify-between gap-5">

          <div>

            <h1 className="text-6xl font-black tracking-tight">

              Cloud Inventory ERP

            </h1>



            <div className="mt-3 space-y-1">

              <p className="text-xl text-zinc-600">

                Professional Inventory System

              </p>

              <p className="text-sm text-zinc-500 font-medium">

                Developed by Kumar Shah

              </p>

            </div>



          </div>

          <div className="flex items-center gap-4">

            <div className="bg-white px-5 py-3 rounded-2xl shadow font-semibold">

              {userEmail}

            </div>

            <button
              onClick={async () => {

                await supabase.auth.signOut()

                router.push('/login')

              }}
              className="bg-red-600 text-white px-5 py-3 rounded-2xl font-bold"
            >

              Logout

            </button>

          </div>

          <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

            <p className="text-lg">

              Total Inventory Cost

            </p>

            <h2 className="text-6xl font-black tracking-tight mt-3">

              Rs. {totalInventoryCost}

            </h2>

          </div>

        </div>

        {/* SCANNER */}

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-8">

          <h2 className="text-4xl font-bold mb-6">

            Barcode Scanner

          </h2>

          <div className="flex gap-4 flex-wrap mb-6">

            <button
              onClick={() =>
                setMode('SELL')
              }
              className={`px-8 py-4 rounded-2xl font-bold ${mode === 'SELL'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200'
                }`}
            >

              SELL MODE

            </button>




            <button
              onClick={() =>
                setMode(
                  'ADD'
                )
              }
              className={`px-10 py-5 rounded-3xl font-bold text-2xl ${mode === 'ADD'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200'
                }`}
            >

              ADD STOCK

            </button>

            <button
              onClick={() =>
                setMode('RETURN')
              }
              className={`px-8 py-4 rounded-2xl font-bold ${mode === 'RETURN'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200'
                }`}
            >

              RETURN MODE

            </button>

            <button
              onClick={() =>
                setShowCamera(
                  !showCamera
                )
              }
              className="bg-zinc-900 hover:bg-zinc-800 hover:scale-105 transition-all duration-200 text-white px-10 py-5 rounded-3xl font-bold text-2xl"
            >

              Camera Scanner

            </button>



          </div>

          <input
            ref={scanInputRef}
            type="text"
            placeholder="Scan barcode"
            value={scanBarcode}
            autoFocus
            onChange={async (e) => {

              const value =
                e.target.value

              setScanBarcode(
                value
              )

              const product =
                products.find(
                  (p) =>
                    p.barcode === value
                )



              /* NEW PRODUCT */

              if (
                !product &&
                mode === 'ADD'
              ) {

                setScanBarcode(
                  value
                )



                return

              }

              /* PRODUCT NOT FOUND */

              if (!product)
                return

              /* SELL MODE */

              if (mode === 'SELL') {

                if (
                  product.current_stock <= 0
                ) {

                  alert(
                    'Out of stock'
                  )

                  return

                }

                await supabase
                  .from('products')
                  .update({

                    current_stock:
                      product.current_stock - 1,

                  })
                  .eq(
                    'id',
                    product.id
                  )

                fetchProducts()

                setScanBarcode('')

                return

              }

              /* RETURN MODE */

              if (mode === 'RETURN') {

                await supabase
                  .from('products')
                  .update({

                    current_stock:
                      product.current_stock + 1,

                  })
                  .eq(
                    'id',
                    product.id
                  )

                fetchProducts()

                setScanBarcode('')

                return

              }

              /* ADD STOCK EXISTING */

              if (mode === 'ADD') {

                setSelectedProduct(
                  product
                )

                setIsNewProduct(
                  false
                )

                setShowAddStockModal(
                  true
                )

              }

            }}

            onKeyDown={(e) => {

              if (
                e.key === 'Enter'
              ) {

                const product =
                  products.find(
                    (p) =>
                      p.barcode ===
                      scanBarcode
                  )

                /* NEW PRODUCT */

                if (
                  !product &&
                  mode === 'ADD'
                ) {

                  setScannedBarcode(
                    scanBarcode
                  )

                  setIsNewProduct(
                    true
                  )

                  setShowAddStockModal(
                    true
                  )

                  return

                }

                /* EXISTING PRODUCT */

                handleBarcodeScan(
                  scanBarcode
                )

              }

            }}




            className="w-full border-2 border-black rounded-2xl px-5 py-5 text-2xl"
          />

          {showCamera && (

            <div className="mt-6 overflow-hidden rounded-3xl border-4 border-black bg-black p-2">
              <div id="reader"></div>
            </div>

          )}



        </div>

        {/* ANALYTICS */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LOW STOCK */}

          <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

            <div className="flex items-center justify-between mb-5">

              <h2 className="text-3xl font-bold">

                Low Stock Products

              </h2>

              <button
                onClick={() =>
                  setShowAllLowStock(
                    !showAllLowStock
                  )
                }
                className="bg-red-600 text-white px-4 py-2 rounded-2xl font-bold"
              >

                {showAllLowStock
                  ? 'Show 5'
                  : 'Show All'}

              </button>

            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto">

              {(showAllLowStock
                ? lowStockProducts
                : lowStockProducts.slice(
                  0,
                  5
                )
              ).map(
                (product) => (

                  <div
                    key={product.id}
                    className="border rounded-2xl p-4"
                  >

                    <h3 className="font-bold text-xl">

                      {
                        product.product_name
                      }

                    </h3>

                    <p className="mt-2">

                      Stock:
                      {' '}
                      <span className="text-red-600 font-bold">

                        {
                          product.current_stock
                        }

                      </span>

                    </p>

                  </div>

                )
              )}

            </div>

          </div>

          {/* TOP SELLING */}

          <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-6">

            <div className="flex items-center justify-between mb-5">

              <h2 className="text-3xl font-bold">

                Top Selling Products

              </h2>

              <button
                onClick={() =>
                  setShowAllTopSelling(
                    !showAllTopSelling
                  )
                }
                className="bg-green-600 text-white px-4 py-2 rounded-2xl font-bold"
              >

                {showAllTopSelling
                  ? 'Show Top 5'
                  : 'Show Top 20'}

              </button>

            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto">

              {topSellingProducts
                .slice(
                  0,
                  showAllTopSelling
                    ? 20
                    : 5
                )
                .map(
                  (
                    product,
                    index
                  ) => (

                    <div
                      key={product.id}
                      className="border rounded-2xl p-4 flex items-center justify-between"
                    >

                      <div>

                        <h3 className="font-bold text-xl">

                          {
                            product.product_name
                          }

                        </h3>

                        <p className="mt-2">

                          Remaining:
                          {' '}
                          <span className="text-green-600 font-bold">

                            {
                              product.current_stock
                            }

                          </span>

                        </p>

                      </div>

                      <div className="w-12 h-12 bg-zinc-900 hover:bg-zinc-800 hover:scale-105 transition-all duration-200 text-white rounded-full flex items-center justify-center font-bold text-xl">

                        {index + 1}

                      </div>

                    </div>

                  )
                )}

            </div>

          </div>

        </div>

        {/* ADD PRODUCT */}

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-8">

          <h2 className="text-4xl font-bold mb-8">

            Add Product

          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

            <input
              type="text"
              placeholder="Barcode"
              value={barcode}
              onChange={(e) =>
                setBarcode(
                  e.target.value
                )
              }
              className="border border-zinc-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none rounded-2xl px-4 py-4"
            />

            <input
              type="text"
              placeholder="Product Name"
              value={productName}
              onChange={(e) =>
                setProductName(
                  e.target.value
                )
              }
              className="border border-zinc-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none rounded-2xl px-4 py-4"
            />

            <input
              list="categories"
              placeholder="Category"
              value={category}

              onChange={(e) =>
                setCategory(
                  e.target.value
                )
              }
              className="border border-zinc-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none rounded-2xl px-4 py-4"
            />

            <datalist id="categories">

              {uniqueCategories.map(
                (
                  cat,
                  index
                ) => (

                  <option
                    key={index}
                    value={cat}
                  />

                )
              )}

            </datalist>

            <input
              type="number"
              placeholder="Cost Price"
              value={costPrice}
              onChange={(e) =>
                setCostPrice(
                  e.target.value
                )
              }
              className="border border-zinc-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none rounded-2xl px-4 py-4"
            />


            <input
              type="number"

              placeholder="Stock"
              value={stock}
              onChange={(e) =>
                setStock(
                  e.target.value
                )
              }
              className="border border-zinc-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none rounded-2xl px-4 py-4"
            />
            <input
              type="text"
              placeholder="Shade"
              value={shade}
              onChange={(e) =>
                setShade(
                  e.target.value
                )
              }
              className="border border-zinc-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none rounded-2xl px-4 py-4"
            />

            <input
              type="text"
              placeholder="Weight"
              value={weight}
              onChange={(e) =>
                setWeight(
                  e.target.value
                )
              }
              className="border border-zinc-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none rounded-2xl px-4 py-4"
            />

            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {

                const file =
                  e.target.files?.[0]

                if (file) {

                  await uploadImage(
                    file
                  )

                }

              }}
              className="border border-zinc-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none rounded-2xl px-4 py-4"
            />



          </div>

          <button
            onClick={addProduct}
            className="bg-zinc-900 hover:bg-zinc-800 hover:scale-105 transition-all duration-200 text-white px-8 py-4 rounded-2xl font-bold text-lg mt-6"
          >

            Add Product

          </button>

        </div>

        {/* INVENTORY */}

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-8">

          <div className="flex flex-wrap gap-3 mb-6">

            <button
              onClick={() =>
                setSelectedCategory(
                  'ALL'
                )
              }
              className={`px-5 py-3 rounded-2xl font-semibold ${selectedCategory ===
                'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-900 hover:bg-zinc-800 hover:scale-105 transition-all duration-200 text-white'
                }`}
            >

              ALL

            </button>

            {uniqueCategories.map(
              (
                cat,
                index
              ) => {

                const categoryProducts =
                  products.filter(
                    (p) =>
                      p.category ===
                      cat
                  )

                const totalQty =
                  categoryProducts.reduce(
                    (
                      sum,
                      p
                    ) =>
                      sum +
                      Number(
                        p.current_stock
                      ),
                    0
                  )

                return (

                  <button
                    key={index}
                    onClick={() =>
                      setSelectedCategory(
                        cat
                      )
                    }
                    className={`px-5 py-3 rounded-2xl font-semibold ${selectedCategory ===
                      cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-900 hover:bg-zinc-800 hover:scale-105 transition-all duration-200 text-white'
                      }`}
                  >

                    {cat}

                    {' | Qty: '}

                    {totalQty}

                  </button>

                )

              }
            )}

          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-8">

            <div>

              <h2 className="text-4xl font-bold">

                Inventory Products

              </h2>

              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                className="border border-zinc-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none rounded-2xl px-4 py-3 w-full max-w-md mt-4"
              />

            </div>

            <button
              onClick={
                exportToExcel
              }
              className="bg-green-600 text-white px-5 py-3 rounded-2xl font-bold"
            >

              Export Excel

            </button>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead>

                <tr className="border-b text-left">

                  <th className="py-4">

                    Image

                  </th>

                  <th>

                    Barcode

                  </th>

                  <th>

                    Product

                  </th>

                  <th>

                    Category

                  </th>

                  <th>

                    Shade

                  </th>

                  <th>

                    Weight

                  </th>

                  <th>

                    Cost

                  </th>

                  <th>

                    Stock

                  </th>

                  <th>

                    Total

                  </th>

                  <th>

                    Edit

                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredProducts.map(
                  (product) => (

                    <tr
                      key={
                        product.id
                      }
                      className="border-b hover:bg-zinc-50 transition-all"
                    >

                      <td className="py-4">

                        {product.image_url ? (

                          <img
                            src={product.image_url}
                            alt=""
                            className="w-16 h-16 rounded-2xl object-cover border"
                          />

                        ) : (

                          <div className="w-16 h-16 bg-gray-200 rounded-2xl" />

                        )}

                      </td>

                      <td>

                        {product.barcode}

                      </td>

                      <td className="font-semibold">

                        {product.product_name}

                      </td>

                      <td>

                        {product.category}

                      </td>

                      <td>

                        {product.shade}

                      </td>

                      <td>

                        {product.weight}

                      </td>

                      <td>

                        Rs. {product.cost_price}

                      </td>

                      <td className="font-bold text-xl">

                        {product.current_stock}

                      </td>

                      <td className="font-bold">

                        Rs.
                        {' '}
                        {product.cost_price *
                          product.current_stock}

                      </td>

                      <td>

                        <button
                          onClick={() => {

                            setEditingProduct(
                              product
                            )

                            setEditName(
                              product.product_name
                            )

                            setEditCategory(
                              product.category
                            )

                            setEditCost(
                              product.cost_price
                            )

                            setEditStock(
                              product.current_stock
                            )

                            setEditBarcode(
                              product.barcode
                            )

                            setEditShade(
                              product.shade
                            )

                            setEditWeight(
                              product.weight
                            )

                            setEditImage(
                              product.image_url
                            )

                          }}
                          className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold"
                        >

                          Edit

                        </button>

                        <button
                          onClick={() =>
                            setDeleteId(
                              product.id
                            )
                          }
                          className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold ml-2"
                        >

                          Delete

                        </button>

                      </td>


                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        </div>

        {/* EDIT MODAL */}

        {editingProduct && (

          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">

            <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-zinc-200 w-full max-w-lg">

              <h2 className="text-3xl font-bold mb-6">

                Edit Product

              </h2>

              <div className="space-y-4">

                <input
                  type="text"
                  value={editBarcode}
                  onChange={(e) =>
                    setEditBarcode(
                      e.target.value
                    )
                  }
                  placeholder="Barcode"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

                <input
                  type="text"
                  value={editName}
                  onChange={(e) =>
                    setEditName(
                      e.target.value
                    )
                  }
                  placeholder="Product"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) =>
                    setEditCategory(
                      e.target.value
                    )
                  }
                  placeholder="Category"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

                <input
                  type="text"
                  value={editShade}
                  onChange={(e) =>
                    setEditShade(
                      e.target.value
                    )
                  }
                  placeholder="Shade"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

                <input
                  type="text"
                  value={editWeight}
                  onChange={(e) =>
                    setEditWeight(
                      e.target.value
                    )
                  }
                  placeholder="Weight"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

                <input
                  type="number"
                  value={editCost}
                  onChange={(e) =>
                    setEditCost(
                      e.target.value
                    )
                  }
                  placeholder="Cost"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

                <input
                  type="number"
                  value={editStock}
                  onChange={(e) =>
                    setEditStock(
                      e.target.value
                    )
                  }
                  placeholder="Stock"
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

                {editImage && (

                  <img
                    src={editImage}
                    alt=""
                    className="w-32 h-32 rounded-2xl object-cover border"
                  />

                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {

                    const file =
                      e.target.files?.[0]

                    if (file) {

                      const fileName =
                        `${Date.now()}-${file.name}`

                      await supabase.storage
                        .from('products')
                        .upload(
                          fileName,
                          file
                        )

                      const { data } =
                        supabase.storage
                          .from('products')
                          .getPublicUrl(
                            fileName
                          )

                      setEditImage(
                        data.publicUrl
                      )

                    }

                  }}
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

              </div>

              <div className="flex gap-4 mt-6">

                <button
                  onClick={
                    updateProduct
                  }
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 hover:scale-105 transition-all duration-200 text-white py-4 rounded-2xl font-bold"
                >

                  Update

                </button>

                <button
                  onClick={() =>
                    setEditingProduct(
                      null
                    )
                  }
                  className="flex-1 bg-gray-300 py-4 rounded-2xl font-bold"
                >

                  Cancel

                </button>

              </div>

            </div>

          </div>

        )}

      </div>


      {showAddStockModal && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-zinc-200 w-full max-w-2xl shadow-2xl">

            <h2 className="text-4xl font-bold mb-8">

              {isNewProduct
                ? 'Add New Product'
                : 'Add Stock'}

            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <input
                type="text"
                value={scannedBarcode}
                disabled
                className="border-2 rounded-2xl px-4 py-4 bg-zinc-100"
              />

              {isNewProduct && (

                <>

                  <input
                    type="text"
                    placeholder="Product Name"
                    value={productName}
                    onChange={(e) =>
                      setProductName(
                        e.target.value
                      )
                    }
                    className="border-2 rounded-2xl px-4 py-4"
                  />

                  <input
                    list="categories"
                    placeholder="Category"
                    value={category}
                    onChange={(e) =>
                      setCategory(
                        e.target.value
                      )
                    }
                    className="border-2 rounded-2xl px-4 py-4"
                  />

                  <datalist id="categories">

                    {uniqueCategories.map(
                      (
                        cat,
                        index
                      ) => (

                        <option
                          key={index}
                          value={cat}
                        />

                      )
                    )}

                  </datalist>



                  <input
                    type="text"
                    placeholder="Shade"
                    value={shade}
                    onChange={(e) =>
                      setShade(
                        e.target.value
                      )
                    }
                    className="border-2 rounded-2xl px-4 py-4"
                  />

                  <input
                    type="text"
                    placeholder="Weight"
                    value={weight}
                    onChange={(e) =>
                      setWeight(
                        e.target.value
                      )
                    }
                    className="border-2 rounded-2xl px-4 py-4"
                  />

                </>

              )}

              <input
                type="number"
                placeholder="Quantity"
                value={stockQty}
                onChange={(e) =>
                  setStockQty(
                    e.target.value
                  )
                }
                className="border-2 rounded-2xl px-4 py-4"
              />

              <input
                type="number"
                placeholder="Cost Price"
                value={stockRate}
                onChange={(e) =>
                  setStockRate(
                    e.target.value
                  )
                }
                className="border-2 rounded-2xl px-4 py-4"
              />

            </div>

            <div className="flex gap-4 mt-8">

              <button
                onClick={async () => {

                  if (isNewProduct) {

                    await supabase
                      .from('products')
                      .insert([
                        {

                          barcode:
                            scannedBarcode,

                          product_name:
                            productName,

                          category,

                          shade,

                          weight,

                          current_stock:
                            Number(
                              stockQty
                            ),

                          cost_price:
                            Number(
                              stockRate
                            ),

                        },
                      ])

                  } else {

                    await supabase
                      .from('products')
                      .update({

                        current_stock:

                          Number(
                            selectedProduct.current_stock
                          ) +

                          Number(
                            stockQty
                          ),

                        cost_price:
                          Number(
                            stockRate
                          ),

                      })
                      .eq(
                        'id',
                        selectedProduct.id
                      )

                  }

                  fetchProducts()

                  setShowAddStockModal(
                    false
                  )

                  setStockQty('')

                  setStockRate('')

                }}
                className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-bold text-xl"
              >

                Save

              </button>

              <button
                onClick={() =>
                  setShowAddStockModal(
                    false
                  )
                }
                className="flex-1 bg-gray-200 py-4 rounded-2xl font-bold text-xl"
              >

                Cancel

              </button>

            </div>

          </div>

        </div>

      )}
    </div>



  )

}