'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { Html5Qrcode } from "html5-qrcode"
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// ---- Low stock reorder configuration ----
// Reorder Point = max(units sold in the last SALES_WINDOW_DAYS, MIN_FLOOR)
// e.g. sold 10 in the last 7 days -> flagged low stock once stock <= 10
const SALES_WINDOW_DAYS = 7   // lookback window used to size the reorder point
const MIN_FLOOR = 2           // minimum reorder point even for zero-sales items

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Home() {

  const router = useRouter()

  const scannerRef = useRef<Html5Qrcode | null>(null)

  const scannerStartingRef = useRef(false)

  const scanInputRef = useRef<any>(null)

  const lastScannedRef = useRef('')

  const lastScanTimeRef = useRef(0)

  const [deleteProductId,
    setDeleteProductId] =
    useState<any>(null)

  const [products, setProducts] =
    useState<any[]>([])

  const [userEmail,
    setUserEmail] =
    useState('')

  const [message, setMessage] = useState('')

  const [barcode, setBarcode] =
    useState('')

  const [productName,
    setProductName] =
    useState('')

  const [category,
    setCategory] =
    useState('')

  const [brand,
    setBrand] =
    useState('')

  const [costPrice,
    setCostPrice] =
    useState('')

  const [mrp,
    setMrp] =
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

  const [selectedBrand,
    setSelectedBrand] =
    useState('ALL')

  const [showCamera,
    setShowCamera] =
    useState(false)

  const [availableCameras,
    setAvailableCameras] =
    useState<any[]>([])

  const [selectedCamera,
    setSelectedCamera] =
    useState("")

  const [showAllTopSelling,
    setShowAllTopSelling] =
    useState(false)

  const [showAllLowStock,
    setShowAllLowStock] =
    useState(false)

  const [editingProduct,
    setEditingProduct] =
    useState<any>(null)

  const [editName,
    setEditName] =
    useState('')

  const [editCategory,
    setEditCategory] =
    useState('')

  const [editBrand,
    setEditBrand] =
    useState('')

  const [editCost,
    setEditCost] =
    useState('')

  const [editMrp,
    setEditMrp] =
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

  const [selectedProduct,
    setSelectedProduct] =
    useState<any>(null)

  // ---- Adjust Stock (sets exact stock, does not add) ----
  const [showAdjustStockModal,
    setShowAdjustStockModal] =
    useState(false)

  const [adjustStockQty,
    setAdjustStockQty] =
    useState('')

  const [adjustCostPrice,
    setAdjustCostPrice] =
    useState('')

  // ---- Stock-in session (Start -> scan repeatedly -> Done) ----
  const [stockSessionActive,
    setStockSessionActive] =
    useState(false)

  const [showSessionStartForm,
    setShowSessionStartForm] =
    useState(false)

  const [sessionSeller,
    setSessionSeller] =
    useState('')

  const [sessionDate,
    setSessionDate] =
    useState(todayISO())

  const [sessionLotId,
    setSessionLotId] =
    useState('')

  const [sessionItems,
    setSessionItems] =
    useState<any[]>([])

  const [sessionNewProduct,
    setSessionNewProduct] =
    useState<any>(null)

  const [stockInHistory,
    setStockInHistory] =
    useState<any[]>([])

  useEffect(() => {

    async function loadData() {

      checkUser()

      const productsData =
        await fetchProducts()

      await fetchTopSellingProducts(
        productsData
      )

      await fetchStockInHistory()

    }

    loadData()

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

    const startScanner = async () => {

      const cameras = await Html5Qrcode.getCameras()

      setAvailableCameras(cameras)

      const savedCamera =
        localStorage.getItem(
          "selectedCamera"
        )

      const cameraToUse =
        savedCamera ||
        cameras[0]?.id

      setSelectedCamera(
        cameraToUse
      )

      await scanner.start(
        cameraToUse,
        {
          fps: 20,
          qrbox: 450,
          aspectRatio: 1.0
        },
        async (decodedText) => {

          const now = Date.now()

          if (
            lastScannedRef.current === decodedText &&
            now - lastScanTimeRef.current < 5000
          ) {
            return
          }

          lastScannedRef.current = decodedText
          lastScanTimeRef.current = now

          setScanBarcode(decodedText)

          await handleBarcodeScan(decodedText)

        },
        () => { }
      )

      scannerStartingRef.current = false
    }

    startScanner().catch((err) => {
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

  const [
    topSellingProducts,
    setTopSellingProducts
  ] = useState<any[]>([])

  async function fetchProducts() {

    const { data } =
      await supabase
        .from('products')
        .select('*')
        .order(
          'product_name',
          {
            ascending: true,
          }
        )

    if (data) {

      setProducts(data)

      return data

    }

    return []

  }

  async function fetchTopSellingProducts(
    productsData: any[]
  ) {

    const thirtyDaysAgo =
      new Date()

    thirtyDaysAgo.setDate(
      thirtyDaysAgo.getDate() - 30
    )

    const { data } =
      await supabase
        .from('stock_transactions')
        .select('*')
        .eq(
          'transaction_type',
          'SELL'
        )
        .gte(
          'created_at',
          thirtyDaysAgo.toISOString()
        )

    if (!data) return

    const salesWindowAgo = new Date()

    salesWindowAgo.setDate(
      salesWindowAgo.getDate() - SALES_WINDOW_DAYS
    )

    const salesMap: any = {}

    const recentSalesMap: any = {}

    data.forEach((sale) => {

      if (
        !salesMap[
        sale.product_id
        ]
      ) {

        salesMap[
          sale.product_id
        ] = 0

      }

      salesMap[
        sale.product_id
      ] += sale.quantity

      const soldAt =
        new Date(sale.created_at)

      if (soldAt >= salesWindowAgo) {

        if (
          !recentSalesMap[
          sale.product_id
          ]
        ) {

          recentSalesMap[
            sale.product_id
          ] = 0

        }

        recentSalesMap[
          sale.product_id
        ] += sale.quantity

      }

    })

    const rankedProducts =
      [...productsData]
        .map(product => {

          const sold =
            salesMap[
            product.id
            ] || 0

          const sold7 =
            recentSalesMap[
            product.id
            ] || 0

          const reorderPoint =
            Math.max(
              sold7,
              MIN_FLOOR
            )

          return {

            ...product,

            sold,

            sold7,

            reorderPoint,

          }

        })
        .sort(
          (a, b) =>
            b.sold - a.sold
        )

    setTopSellingProducts(
      rankedProducts
    )

  }

  async function fetchStockInHistory() {

    const { data } =
      await supabase
        .from('stock_transactions')
        .select('*')
        .eq(
          'transaction_type',
          'ADD'
        )
        .order(
          'stock_date',
          {
            ascending: false,
          }
        )

    if (data) {

      setStockInHistory(data)

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

            brand,

            cost_price:
              Number(costPrice),

            mrp:
              mrp ? Number(mrp) : null,

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
    setBrand('')
    setCostPrice('')
    setMrp('')
    setStock('')
    setShade('')
    setWeight('')
    setImageUrl('')

    const productsData =
      await fetchProducts()

    await fetchTopSellingProducts(
      productsData
    )

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

  // ---- Stock session helpers ----

  function addOrIncrementSessionItem(product: any) {

    setSessionItems((prev) => {

      const idx = prev.findIndex(
        (i) => i.productId === product.id
      )

      if (idx >= 0) {

        const updated = [...prev]

        updated[idx] = {
          ...updated[idx],
          qty: Number(updated[idx].qty) + 1,
        }

        return updated

      }

      return [
        ...prev,
        {
          productId: product.id,
          barcode: product.barcode,
          name: product.product_name,
          image: product.image_url,
          category: product.category,
          brand: product.brand,
          shade: product.shade,
          qty: 1,
          costPrice: product.cost_price,
        },
      ]

    })

  }

  function beginScanning() {

    if (!sessionSeller) {

      alert('Enter a seller / supplier name first')

      return

    }

    setSessionLotId(
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    )

    setSessionItems([])

    setStockSessionActive(true)

    setShowSessionStartForm(false)

  }

  function cancelSession() {

    setStockSessionActive(false)

    setShowSessionStartForm(false)

    setSessionItems([])

    setSessionSeller('')

    setSessionDate(todayISO())

    setSessionLotId('')

    setSessionNewProduct(null)

  }

  function updateSessionItemQty(index: number, qty: string) {

    setSessionItems((prev) => {

      const updated = [...prev]

      updated[index] = {
        ...updated[index],
        qty: qty,
      }

      return updated

    })

  }

  function updateSessionItemCost(index: number, cost: string) {

    setSessionItems((prev) => {

      const updated = [...prev]

      updated[index] = {
        ...updated[index],
        costPrice: cost,
      }

      return updated

    })

  }

  function removeSessionItem(index: number) {

    setSessionItems((prev) =>
      prev.filter((_, i) => i !== index)
    )

  }

  async function confirmSessionNewProduct() {

    if (!sessionNewProduct.name) {

      alert('Enter a product name')

      return

    }

    const { data: inserted, error } =
      await supabase
        .from('products')
        .insert([
          {

            barcode: sessionNewProduct.barcode,

            product_name: sessionNewProduct.name,

            category: sessionNewProduct.category,

            brand: sessionNewProduct.brand,

            shade: sessionNewProduct.shade,

            weight: sessionNewProduct.weight,

            mrp:
              sessionNewProduct.mrp
                ? Number(sessionNewProduct.mrp)
                : null,

            cost_price:
              Number(sessionNewProduct.costPrice) || 0,

            current_stock: 0,

          },
        ])
        .select()
        .single()

    if (error || !inserted) {

      alert(error?.message || 'Failed to add product')

      return

    }

    setSessionItems((prev) => [
      ...prev,
      {
        productId: inserted.id,
        barcode: inserted.barcode,
        name: inserted.product_name,
        image: inserted.image_url,
        category: inserted.category,
        brand: inserted.brand,
        shade: inserted.shade,
        qty: Number(sessionNewProduct.qty) || 1,
        costPrice: Number(sessionNewProduct.costPrice) || 0,
      },
    ])

    setSessionNewProduct(null)

    await fetchProducts()

  }

  async function finishStockSession() {

    if (sessionItems.length === 0) {

      alert('No items scanned yet')

      return

    }

    for (const item of sessionItems) {

      const currentProduct =
        products.find(
          (p) => p.id === item.productId
        )

      const baseStock =
        currentProduct
          ? currentProduct.current_stock
          : 0

      const newStock =
        Number(baseStock) + Number(item.qty)

      await supabase
        .from('products')
        .update({

          current_stock: newStock,

          cost_price: Number(item.costPrice),

        })
        .eq('id', item.productId)

      await supabase
        .from('stock_transactions')
        .insert([
          {

            product_id: item.productId,

            user_email: userEmail,

            transaction_type: 'ADD',

            quantity: Number(item.qty),

            cost_price: Number(item.costPrice),

            seller: sessionSeller,

            stock_date: sessionDate,

            lot_id: sessionLotId,

            final_stock: newStock,

          },
        ])

    }

    const productsData =
      await fetchProducts()

    await fetchTopSellingProducts(
      productsData
    )

    await fetchStockInHistory()

    alert(
      `Stock lot saved: ${sessionItems.length} product(s) updated`
    )

    cancelSession()

  }

  async function handleBarcodeScan(
    code: string
  ) {

    if (mode === 'ADD') {

      if (!stockSessionActive) {

        alert('Start a stock session first')

        return

      }

      const product =
        products.find(
          (p) => p.barcode === code
        )

      if (product) {

        addOrIncrementSessionItem(product)

      } else {

        setSessionNewProduct({
          barcode: code,
          name: '',
          category: '',
          brand: '',
          shade: '',
          weight: '',
          mrp: '',
          costPrice: '',
          qty: '1',
        })

      }

      return

    }

    const product =
      products.find(
        (p) => p.barcode === code
      )

    if (!product) {

      alert('Product not found')

      return

    }

    if (mode === 'SELL') {

      if (
        product.current_stock <= 0
      ) {

        alert('Out of stock')

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
        .from('stock_transactions')
        .insert([
          {

            product_id: product.id,

            user_email: userEmail,

            transaction_type: 'SELL',

            quantity: 1,

          },
        ])

      fetchProducts()

      setMessage(
        `${product.product_name} sold`
      )

      setTimeout(() => {
        setMessage('')
      }, 1000)

      setScanBarcode('')

      return

    }

    if (mode === 'RETURN') {

      await processReturn(product)

      setScanBarcode('')

      return

    }

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

        brand:
          editBrand,

        shade:
          editShade,

        weight:
          editWeight,

        cost_price:
          Number(editCost),

        mrp:
          editMrp ? Number(editMrp) : null,

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

          Brand:
            product.brand,

          Cost:
            product.cost_price,

          MRP:
            product.mrp,

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

  function exportLowStockToExcel() {

    const exportData =
      lowStockProducts.map(
        (product) => ({
          Product:
            product.product_name,

          Category:
            product.category,

          Shade:
            product.shade,

          Brand:
            product.brand,

          MRP:
            product.mrp,

          'Current Stock':
            product.current_stock,

          'Sold (30d)':
            product.sold,

          'Reorder Point':
            Math.ceil(
              product.reorderPoint
            ),
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
      'Low Stock'
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
      'low-stock.xlsx'
    )

  }

  function exportTopSellingToExcel() {

    const exportData =
      topSellingProducts.map(
        (product) => ({
          Product:
            product.product_name,

          Category:
            product.category,

          Shade:
            product.shade,

          Brand:
            product.brand,

          MRP:
            product.mrp,

          'Current Stock':
            product.current_stock,

          'Sold (30d)':
            product.sold,

          'Reorder Point':
            Math.ceil(
              product.reorderPoint
            ),
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
      'Top Selling'
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
      'top-selling.xlsx'
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

  const uniqueBrands =
    [
      ...new Set(
        products
          .map((p) => p.brand)
          .filter((b) => !!b)
      ),
    ]

  const uniqueSellers =
    [
      ...new Set(
        stockInHistory
          .map((t) => t.seller)
          .filter((s) => !!s)
      ),
    ]

  const filteredProducts =
    products
      .filter(
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

          const matchesBrand =
            selectedBrand ===
            'ALL' ||
            product.brand ===
            selectedBrand

          return (
            matchesSearch &&
            matchesCategory &&
            matchesBrand
          )

        }
      )
      .sort(
        (a, b) =>
          (a.product_name || '').localeCompare(
            b.product_name || ''
          )
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
    topSellingProducts
      .filter(
        (p) =>
          p.current_stock <= p.reorderPoint
      )
      .sort(
        (a, b) =>
          a.current_stock - b.current_stock
      )

  const showScanUI =
    mode !== 'ADD' || stockSessionActive

  return (

    <div className="min-h-screen bg-zinc-100 p-6 text-black">

      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">

          <div className="flex items-start gap-4">

            <div className="w-12 h-12 rounded-xl bg-zinc-900 text-white flex items-center justify-center flex-shrink-0 mt-1">

              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-6 h-6"
              >

                <ellipse cx="12" cy="5" rx="8" ry="3" />

                <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />

                <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />

              </svg>

            </div>

            <div>

              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">

                Cloud Inventory ERP

              </h1>

              <p className="text-base text-zinc-500 mt-1">

                Professional Inventory System

              </p>

              <p className="text-xs text-zinc-400 mt-0.5">

                Developed by Kumar Shah

              </p>

            </div>

          </div>

          <div className="flex items-center gap-6 flex-wrap">

            <div className="flex items-center gap-3">

              <div className="bg-white px-4 py-2.5 rounded-xl shadow-sm border border-zinc-200 text-sm font-medium text-zinc-700">

                {userEmail}

              </div>

              <button
                onClick={() =>
                  router.push('/stock-log')
                }
                className="bg-amber-400 border border-amber-500 text-zinc-900 hover:bg-amber-500 transition-colors px-4 py-2.5 rounded-xl text-sm font-semibold"
              >

                Stock Log

              </button>

              <button
                onClick={() =>
                  router.push('/accounting')
                }
                className="bg-amber-400 border border-amber-500 text-zinc-900 hover:bg-amber-500 transition-colors px-4 py-2.5 rounded-xl text-sm font-semibold"
              >

                Supplier

              </button>

              <button
                onClick={async () => {

                  await supabase.auth.signOut()

                  router.push('/login')

                }}
                className="bg-white border border-zinc-200 text-zinc-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors px-4 py-2.5 rounded-xl text-sm font-semibold"
              >

                Logout

              </button>

            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 border-l-4 border-l-zinc-900 px-6 py-4 min-w-[220px]">

              <p className="text-sm text-zinc-500">

                Total Inventory Cost

              </p>

              <h2 className="text-3xl font-bold tracking-tight mt-1 tabular-nums">

                Rs. {totalInventoryCost.toLocaleString()}

              </h2>

            </div>

          </div>

        </div>

        {/* SCANNER */}

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-8">

          <h2 className="text-2xl font-bold mb-6 text-zinc-900">

            Barcode Scanner

          </h2>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">

            <div className="flex gap-2 bg-zinc-100 p-1.5 rounded-2xl flex-1">

              <button
                onClick={() =>
                  setMode('SELL')
                }
                className={`flex-1 px-6 py-3 rounded-xl font-semibold text-sm transition-colors ${mode === 'SELL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:bg-zinc-200'
                  }`}
              >

                Sell

              </button>

              <button
                onClick={() =>
                  setMode(
                    'ADD'
                  )
                }
                className={`flex-1 px-6 py-3 rounded-xl font-semibold text-sm transition-colors ${mode === 'ADD'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:bg-zinc-200'
                  }`}
              >

                Add Stock

              </button>

              <button
                onClick={() =>
                  setMode('RETURN')
                }
                className={`flex-1 px-6 py-3 rounded-xl font-semibold text-sm transition-colors ${mode === 'RETURN'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:bg-zinc-200'
                  }`}
              >

                Return

              </button>

            </div>

            <button
              onClick={() =>
                setShowCamera(
                  !showCamera
                )
              }
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm transition-colors ${showCamera
                ? 'bg-zinc-900 text-white'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
            >

              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-4 h-4"
              >

                <path d="M23 7l-7 5 7 5V7z" />

                <rect x="1" y="5" width="15" height="14" rx="2" />

              </svg>

              {showCamera ? 'Hide Camera' : 'Camera Scanner'}

            </button>

          </div>

          {message && (
            <div className="mb-3 bg-green-600 text-white text-center font-bold py-3 rounded-xl">
              {message}
            </div>
          )}

          {/* ADD STOCK: session start gate */}

          {mode === 'ADD' && !stockSessionActive && (

            <div className="mb-6">

              {!showSessionStartForm ? (

                <button
                  onClick={() =>
                    setShowSessionStartForm(true)
                  }
                  className="w-full bg-green-600 hover:bg-green-700 transition-colors text-white font-bold text-lg py-5 rounded-2xl"
                >

                  Start Adding Stock

                </button>

              ) : (

                <div className="border-2 border-green-200 rounded-2xl p-6 bg-green-50 space-y-4">

                  <h3 className="font-bold text-lg text-zinc-900">

                    Start Stock Lot

                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <div>

                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">

                        Seller / Supplier

                      </label>

                      <input
                        type="text"
                        list="sellers"
                        placeholder="Seller name"
                        value={sessionSeller}
                        onChange={(e) =>
                          setSessionSeller(
                            e.target.value
                          )
                        }
                        className="w-full border-2 rounded-2xl px-4 py-3 bg-white"
                      />

                      <datalist id="sellers">

                        {uniqueSellers.map(
                          (
                            s,
                            index
                          ) => (

                            <option
                              key={index}
                              value={s}
                            />

                          )
                        )}

                      </datalist>

                    </div>

                    <div>

                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">

                        Stock Date

                      </label>

                      <input
                        type="date"
                        value={sessionDate}
                        onChange={(e) =>
                          setSessionDate(
                            e.target.value
                          )
                        }
                        className="w-full border-2 rounded-2xl px-4 py-3 bg-white"
                      />

                    </div>

                  </div>

                  <div className="flex gap-3">

                    <button
                      onClick={beginScanning}
                      className="flex-1 bg-green-600 hover:bg-green-700 transition-colors text-white font-bold py-3 rounded-2xl"
                    >

                      Begin Scanning

                    </button>

                    <button
                      onClick={() =>
                        setShowSessionStartForm(false)
                      }
                      className="flex-1 bg-gray-200 hover:bg-gray-300 transition-colors font-bold py-3 rounded-2xl"
                    >

                      Cancel

                    </button>

                  </div>

                </div>

              )}

            </div>

          )}

          {showScanUI && (

            <>

              <div className="relative">

                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                >

                  <path d="M3 5v14M7 5v14M10 5v14M14 5v10M17 5v14M21 5v14" />

                </svg>

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

                  if (mode === 'ADD') {

                    if (!product) return

                    if (!stockSessionActive) return

                    addOrIncrementSessionItem(product)

                    setScanBarcode('')

                    return

                  }

                  if (!product) return

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

                    await supabase
                      .from('stock_transactions')
                      .insert([
                        {
                          product_id: product.id,
                          user_email: userEmail,
                          transaction_type: 'SELL',
                          quantity: 1,
                        },
                      ])

                    fetchProducts()

                    setMessage(
                      `${product.product_name} sold`
                    )

                    setTimeout(() => {
                      setMessage('')
                    }, 1000)

                    setScanBarcode('')

                    return

                  }

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

                }}

                onKeyDown={(e) => {

                  if (
                    e.key !== 'Enter'
                  ) return

                  if (mode === 'ADD') {

                    if (!stockSessionActive) return

                    const product =
                      products.find(
                        (p) =>
                          p.barcode ===
                          scanBarcode
                      )

                    if (product) {

                      addOrIncrementSessionItem(product)

                    } else if (scanBarcode) {

                      setSessionNewProduct({
                        barcode: scanBarcode,
                        name: '',
                        category: '',
                        brand: '',
                        shade: '',
                        weight: '',
                        mrp: '',
                        costPrice: '',
                        qty: '1',
                      })

                    }

                    setScanBarcode('')

                    return

                  }

                  handleBarcodeScan(
                    scanBarcode
                  )

                }}

                className="w-full border border-zinc-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none rounded-2xl pl-12 pr-5 py-4 text-xl transition-shadow"
              />

              </div>

              {
                mode === 'ADD' &&
                stockSessionActive &&
                scanBarcode &&
                !products.find(
                  p => p.barcode === scanBarcode
                ) && (

                  <button
                    onClick={() => {

                      setSessionNewProduct({
                        barcode: scanBarcode,
                        name: '',
                        category: '',
                        brand: '',
                        shade: '',
                        weight: '',
                        mrp: '',
                        costPrice: '',
                        qty: '1',
                      })

                      setScanBarcode('')

                    }}
                    className="mt-3 w-full bg-amber-500 hover:bg-amber-600 transition-colors text-white font-semibold py-4 rounded-2xl"
                  >
                    Add New Product to Lot
                  </button>

                )
              }

              {showCamera && (

                <div className="mt-6 overflow-hidden rounded-3xl border border-zinc-800 bg-black p-2">
                  <div
                    id="reader"
                    className="w-full min-h-[550px]"
                  ></div>
                </div>

              )}

              <div className="mb-2 mt-4">

                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">

                  Camera source

                </label>

                <select
                  value={selectedCamera}
                  onChange={(e) => {

                    const cameraId =
                      e.target.value

                    setSelectedCamera(
                      cameraId
                    )

                    localStorage.setItem(
                      "selectedCamera",
                      cameraId
                    )

                    window.location.reload()

                  }}

                  className="w-full bg-white border border-zinc-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none rounded-2xl px-5 py-3.5 text-zinc-700 font-medium"
                >

                  {availableCameras.map(
                    (camera) => (

                      <option
                        key={camera.id}
                        value={camera.id}
                      >

                        {camera.label}

                      </option>

                    )
                  )}

                </select>

              </div>

            </>

          )}

          {/* ACTIVE STOCK LOT PANEL */}

          {mode === 'ADD' && stockSessionActive && (

            <div className="mt-6 border-2 border-zinc-200 rounded-2xl p-6 space-y-4">

              <div className="flex items-center justify-between flex-wrap gap-3">

                <div>

                  <p className="text-sm text-zinc-500">

                    Current Stock Lot

                  </p>

                  <p className="font-bold text-lg text-zinc-900">

                    {sessionSeller || 'No seller set'}
                    {' · '}
                    {sessionDate}

                  </p>

                </div>

                <div className="flex gap-2">

                  <button
                    onClick={finishStockSession}
                    className="bg-green-600 hover:bg-green-700 transition-colors text-white px-6 py-3 rounded-xl font-bold"
                  >

                    Done

                  </button>

                  <button
                    onClick={cancelSession}
                    className="bg-gray-200 hover:bg-gray-300 transition-colors px-6 py-3 rounded-xl font-bold"
                  >

                    Cancel Session

                  </button>

                </div>

              </div>

              {sessionNewProduct && (

                <div className="border rounded-2xl p-4 bg-amber-50 space-y-3">

                  <p className="font-semibold text-zinc-900">

                    New product scanned: {sessionNewProduct.barcode}

                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    <input
                      placeholder="Product Name"
                      value={sessionNewProduct.name}
                      onChange={(e) =>
                        setSessionNewProduct({
                          ...sessionNewProduct,
                          name: e.target.value,
                        })
                      }
                      className="border-2 rounded-xl px-3 py-2.5 bg-white"
                    />

                    <input
                      list="categories"
                      placeholder="Category"
                      value={sessionNewProduct.category}
                      onChange={(e) =>
                        setSessionNewProduct({
                          ...sessionNewProduct,
                          category: e.target.value,
                        })
                      }
                      className="border-2 rounded-xl px-3 py-2.5 bg-white"
                    />

                    <input
                      list="brands"
                      placeholder="Brand"
                      value={sessionNewProduct.brand}
                      onChange={(e) =>
                        setSessionNewProduct({
                          ...sessionNewProduct,
                          brand: e.target.value,
                        })
                      }
                      className="border-2 rounded-xl px-3 py-2.5 bg-white"
                    />

                    <input
                      placeholder="Shade"
                      value={sessionNewProduct.shade}
                      onChange={(e) =>
                        setSessionNewProduct({
                          ...sessionNewProduct,
                          shade: e.target.value,
                        })
                      }
                      className="border-2 rounded-xl px-3 py-2.5 bg-white"
                    />

                    <input
                      placeholder="Weight"
                      value={sessionNewProduct.weight}
                      onChange={(e) =>
                        setSessionNewProduct({
                          ...sessionNewProduct,
                          weight: e.target.value,
                        })
                      }
                      className="border-2 rounded-xl px-3 py-2.5 bg-white"
                    />

                    <input
                      type="number"
                      placeholder="MRP"
                      value={sessionNewProduct.mrp}
                      onChange={(e) =>
                        setSessionNewProduct({
                          ...sessionNewProduct,
                          mrp: e.target.value,
                        })
                      }
                      className="border-2 rounded-xl px-3 py-2.5 bg-white"
                    />

                    <input
                      type="number"
                      placeholder="Cost Price"
                      value={sessionNewProduct.costPrice}
                      onChange={(e) =>
                        setSessionNewProduct({
                          ...sessionNewProduct,
                          costPrice: e.target.value,
                        })
                      }
                      className="border-2 rounded-xl px-3 py-2.5 bg-white"
                    />

                    <input
                      type="number"
                      placeholder="Quantity"
                      value={sessionNewProduct.qty}
                      onChange={(e) =>
                        setSessionNewProduct({
                          ...sessionNewProduct,
                          qty: e.target.value,
                        })
                      }
                      className="border-2 rounded-xl px-3 py-2.5 bg-white"
                    />

                  </div>

                  <div className="flex gap-3">

                    <button
                      onClick={confirmSessionNewProduct}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 transition-colors text-white py-3 rounded-xl font-bold"
                    >

                      Add to Lot

                    </button>

                    <button
                      onClick={() =>
                        setSessionNewProduct(null)
                      }
                      className="flex-1 bg-gray-200 hover:bg-gray-300 transition-colors py-3 rounded-xl font-bold"
                    >

                      Skip

                    </button>

                  </div>

                </div>

              )}

              {sessionItems.length === 0 ? (

                <p className="text-sm text-zinc-400">

                  No items scanned yet — scan a barcode above to add it to this lot.

                </p>

              ) : (

                <div className="space-y-3 max-h-96 overflow-y-auto">

                  {sessionItems.map(
                    (item, index) => (

                      <div
                        key={index}
                        className="flex items-center gap-3 border rounded-xl p-3"
                      >

                        {item.image ? (

                          <img
                            src={item.image}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border flex-shrink-0"
                          />

                        ) : (

                          <div className="w-10 h-10 rounded-lg bg-zinc-100 border flex-shrink-0" />

                        )}

                        <div className="flex-1 min-w-0">

                          <p className="font-semibold text-sm text-zinc-900 truncate">

                            {item.name}

                          </p>

                          <p className="text-xs text-zinc-400">

                            {item.barcode}

                          </p>

                        </div>

                        <div>

                          <label className="text-[10px] text-zinc-400 block">Qty</label>

                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) =>
                              updateSessionItemQty(
                                index,
                                e.target.value
                              )
                            }
                            className="w-16 border rounded-lg px-2 py-1 text-sm"
                          />

                        </div>

                        <div>

                          <label className="text-[10px] text-zinc-400 block">Cost</label>

                          <input
                            type="number"
                            value={item.costPrice}
                            onChange={(e) =>
                              updateSessionItemCost(
                                index,
                                e.target.value
                              )
                            }
                            className="w-20 border rounded-lg px-2 py-1 text-sm"
                          />

                        </div>

                        <button
                          onClick={() =>
                            removeSessionItem(index)
                          }
                          className="text-red-500 hover:text-red-700 text-lg font-bold px-2"
                        >

                          ×

                        </button>

                      </div>

                    )
                  )}

                </div>

              )}

              <p className="text-sm text-zinc-500">

                {sessionItems.length} product(s)
                {' · '}
                {sessionItems.reduce(
                  (s, i) => s + Number(i.qty || 0),
                  0
                )}
                {' '}total units

              </p>

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

              <div className="flex gap-2">

                <button
                  onClick={exportLowStockToExcel}
                  className="bg-green-600 text-white px-4 py-2 rounded-2xl font-bold"
                >

                  Export

                </button>

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
                    className="border rounded-2xl p-4 flex gap-4"
                  >

                    {product.image_url ? (

                      <img
                        src={product.image_url}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover border flex-shrink-0"
                      />

                    ) : (

                      <div className="w-16 h-16 bg-gray-200 rounded-xl flex-shrink-0" />

                    )}

                    <div className="flex-1 min-w-0">

                      <h3 className="font-bold text-xl">

                        {
                          product.product_name
                        }

                      </h3>

                      <p className="text-sm text-zinc-500 mt-1">

                        {product.category}

                        {product.brand && ` \u00b7 ${product.brand}`}

                        {product.shade && ` \u00b7 ${product.shade}`}

                      </p>

                      <p className="mt-2">

                        Stock:
                        {' '}
                        <span className="text-red-600 font-bold">

                          {
                            product.current_stock
                          }

                        </span>

                        {' '}

                        <span className="text-xs text-zinc-400">

                          (reorder below{' '}
                          {Math.ceil(
                            product.reorderPoint
                          )}
                          )

                        </span>

                      </p>

                    </div>

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

              <div className="flex gap-2">

                <button
                  onClick={exportTopSellingToExcel}
                  className="bg-green-600 text-white px-4 py-2 rounded-2xl font-bold"
                >

                  Export

                </button>

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
                      className="border rounded-2xl p-4 flex items-center justify-between gap-4"
                    >

                      <div className="flex gap-4 min-w-0">

                        {product.image_url ? (

                          <img
                            src={product.image_url}
                            alt=""
                            className="w-16 h-16 rounded-xl object-cover border flex-shrink-0"
                          />

                        ) : (

                          <div className="w-16 h-16 bg-gray-200 rounded-xl flex-shrink-0" />

                        )}

                        <div className="min-w-0">

                          <h3 className="font-bold text-xl">

                            {
                              product.product_name
                            }

                          </h3>

                          <p className="text-sm text-zinc-500 mt-1">

                            {product.category}

                            {product.brand && ` \u00b7 ${product.brand}`}

                            {product.shade && ` \u00b7 ${product.shade}`}

                          </p>

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

                      </div>

                      <div className="w-12 h-12 bg-zinc-900 hover:bg-zinc-800 hover:scale-105 transition-all duration-200 text-white rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0">

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
              list="brands"
              placeholder="Brand"
              value={brand}
              onChange={(e) =>
                setBrand(
                  e.target.value
                )
              }
              className="border border-zinc-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none rounded-2xl px-4 py-4"
            />

            <datalist id="brands">

              {uniqueBrands.map(
                (
                  b,
                  index
                ) => (

                  <option
                    key={index}
                    value={b}
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
              placeholder="MRP"
              value={mrp}
              onChange={(e) =>
                setMrp(
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

          <div className="flex flex-wrap gap-3 mb-3">

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

              ALL CATEGORIES

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

          <div className="flex flex-wrap gap-3 mb-6">

            <button
              onClick={() =>
                setSelectedBrand(
                  'ALL'
                )
              }
              className={`px-5 py-3 rounded-2xl font-semibold ${selectedBrand ===
                'ALL'
                ? 'bg-purple-600 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 hover:scale-105 transition-all duration-200 text-white'
                }`}
            >

              ALL BRANDS

            </button>

            {uniqueBrands.map(
              (
                b,
                index
              ) => (

                <button
                  key={index}
                  onClick={() =>
                    setSelectedBrand(
                      b
                    )
                  }
                  className={`px-5 py-3 rounded-2xl font-semibold ${selectedBrand ===
                    b
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-700 hover:bg-zinc-600 hover:scale-105 transition-all duration-200 text-white'
                    }`}
                >

                  {b}

                </button>

              )
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

          <div className="overflow-x-auto -mx-8 px-8">

            <table className="w-full border-collapse">

              <thead>

                <tr className="text-left">

                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 w-16">

                    Image

                  </th>

                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">

                    Product

                  </th>

                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">

                    Category

                  </th>

                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">

                    Brand

                  </th>

                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">

                    Shade

                  </th>

                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500">

                    Weight

                  </th>

                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">

                    Cost

                  </th>

                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">

                    MRP

                  </th>

                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">

                    Stock

                  </th>

                  <th className="pb-3 pr-4 text-sm font-medium text-zinc-500 text-right">

                    Total

                  </th>

                  <th className="pb-3 text-sm font-medium text-zinc-500 text-right">

                    Actions

                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-zinc-100">

                {filteredProducts.map(
                  (product) => (

                    <tr
                      key={
                        product.id
                      }
                      className="hover:bg-zinc-50 transition-colors"
                    >

                      <td className="py-3 pr-4">

                        {product.image_url ? (

                          <img
                            src={product.image_url}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover border border-zinc-200"
                          />

                        ) : (

                          <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-300">

                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              className="w-6 h-6"
                            >

                              <rect x="3" y="3" width="18" height="18" rx="3" />

                              <circle cx="8.5" cy="9" r="1.5" />

                              <path d="M21 15l-5-5L5 21" />

                            </svg>

                          </div>

                        )}

                      </td>

                      <td className="py-3 pr-4">

                        <div className="font-semibold text-zinc-900">

                          {product.product_name}

                        </div>

                        <div className="text-xs text-zinc-400 mt-0.5">

                          {product.barcode}

                        </div>

                      </td>

                      <td className="py-3 pr-4 text-sm text-zinc-600">

                        {product.category}

                      </td>

                      <td className="py-3 pr-4 text-sm text-zinc-600">

                        {product.brand}

                      </td>

                      <td className="py-3 pr-4 text-sm text-zinc-600">

                        {product.shade}

                      </td>

                      <td className="py-3 pr-4 text-sm text-zinc-600">

                        {product.weight}

                      </td>

                      <td className="py-3 pr-4 text-sm text-zinc-600 text-right tabular-nums">

                        Rs. {product.cost_price}

                      </td>

                      <td className="py-3 pr-4 text-sm text-zinc-600 text-right tabular-nums">

                        {product.mrp ? `Rs. ${product.mrp}` : '—'}

                      </td>

                      <td className="py-3 pr-4 font-semibold text-zinc-900 text-right tabular-nums">

                        {product.current_stock}

                      </td>

                      <td className="py-3 pr-4 font-semibold text-zinc-900 text-right tabular-nums">

                        Rs.
                        {' '}
                        {product.cost_price *
                          product.current_stock}

                      </td>

                      <td className="py-3">

                        <div className="flex items-center justify-end gap-2">

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

                              setEditBrand(
                                product.brand
                              )

                              setEditCost(
                                product.cost_price
                              )

                              setEditMrp(
                                product.mrp
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
                            title="Edit"
                            className="w-9 h-9 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
                          >

                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              className="w-4 h-4"
                            >

                              <path d="M12 20h9" />

                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />

                            </svg>

                          </button>

                          <button
                            onClick={() => {

                              setSelectedProduct(
                                product
                              )

                              setAdjustStockQty(
                                String(
                                  product.current_stock
                                )
                              )

                              setAdjustCostPrice(
                                String(
                                  product.cost_price
                                )
                              )

                              setShowAdjustStockModal(
                                true
                              )

                            }}
                            title="Adjust Stock"
                            className="w-9 h-9 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-green-50 hover:border-green-200 hover:text-green-600 transition-colors"
                          >

                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              className="w-4 h-4"
                            >

                              <path d="M21 8v13H3V8" />

                              <path d="M1 3h22v5H1z" />

                              <path d="M10 12h4" />

                            </svg>

                          </button>

                          <button
                            onClick={() =>
                              setDeleteProductId(product.id)
                            }
                            title="Delete"
                            className="w-9 h-9 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                          >

                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              className="w-4 h-4"
                            >

                              <path d="M3 6h18" />

                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />

                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />

                              <path d="M10 11v6" />

                              <path d="M14 11v6" />

                            </svg>

                          </button>

                        </div>

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
                  value={editBrand}
                  onChange={(e) =>
                    setEditBrand(
                      e.target.value
                    )
                  }
                  placeholder="Brand"
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
                  value={editMrp}
                  onChange={(e) =>
                    setEditMrp(
                      e.target.value
                    )
                  }
                  placeholder="MRP"
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

      {deleteProductId && (

        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">

          <div className="bg-white rounded-3xl p-6 w-80 shadow-2xl">

            <h2 className="text-2xl font-bold text-center">
              Delete Product?
            </h2>

            <p className="text-center text-gray-500 mt-3">
              This action cannot be undone.
            </p>

            <div className="flex gap-3 mt-6">

              <button
                onClick={() =>
                  setDeleteProductId(null)
                }
                className="flex-1 bg-gray-300 hover:bg-gray-400 py-3 rounded-xl font-bold"
              >
                Cancel
              </button>

              <button
                onClick={async () => {

                  await deleteProduct(
                    deleteProductId
                  )

                  setDeleteProductId(null)

                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold"
              >
                Delete
              </button>

            </div>

          </div>

        </div>

      )}

      {showAdjustStockModal && selectedProduct && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-zinc-200 w-full max-w-md">

            <h2 className="text-3xl font-bold mb-2">

              Adjust Stock

            </h2>

            <p className="text-sm text-zinc-500 mb-6">

              {selectedProduct.product_name}
              {' · '}
              {selectedProduct.barcode}

            </p>

            <div className="space-y-4">

              <div>

                <input
                  type="number"
                  placeholder="Final Stock Quantity"
                  value={adjustStockQty}
                  onChange={(e) =>
                    setAdjustStockQty(
                      e.target.value
                    )
                  }
                  className="w-full border-2 rounded-2xl px-4 py-4"
                />

                <p className="text-xs text-zinc-400 mt-1 pl-1">

                  This sets the exact stock count — it does not add to the current amount.

                </p>

              </div>

              <input
                type="number"
                placeholder="Cost Price"
                value={adjustCostPrice}
                onChange={(e) =>
                  setAdjustCostPrice(
                    e.target.value
                  )
                }
                className="w-full border-2 rounded-2xl px-4 py-4"
              />

            </div>

            <div className="flex gap-4 mt-8">

              <button
                onClick={async () => {

                  await supabase
                    .from('products')
                    .update({

                      current_stock:
                        Number(adjustStockQty),

                      cost_price:
                        Number(adjustCostPrice),

                    })
                    .eq(
                      'id',
                      selectedProduct.id
                    )

                  const productsData =
                    await fetchProducts()

                  await fetchTopSellingProducts(
                    productsData
                  )

                  setShowAdjustStockModal(
                    false
                  )

                }}
                className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-bold text-xl"
              >

                Save

              </button>

              <button
                onClick={() =>
                  setShowAdjustStockModal(
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
