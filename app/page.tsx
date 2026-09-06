'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { displayMrp } from '../lib/mrp'
import { useViewer } from '../components/ViewerContext'
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
  const isViewer = useViewer()

  const scanInputRef = useRef<any>(null)

  const [deleteProductId,
    setDeleteProductId] =
    useState<any>(null)

  const [products, setProducts] =
    useState<any[]>([])

  const [userEmail,
    setUserEmail] =
    useState('')

  const [message, setMessage] = useState('')

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

  const [expandedGroups, setExpandedGroups] =
    useState<Record<string, boolean>>({})

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

  const [finishingStockSession,
    setFinishingStockSession] =
    useState(false)

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

    if (finishingStockSession) return

    setFinishingStockSession(true)

    try {

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

              product_name: currentProduct?.product_name || item.name,

              category: currentProduct?.category || item.category,

              brand: currentProduct?.brand || item.brand,

              shade: currentProduct?.shade || item.shade,

              weight: currentProduct?.weight || null,

              mrp: currentProduct?.mrp ?? null,

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

    } finally {

      setFinishingStockSession(false)

    }

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
            displayMrp(product.mrp) ?? '',

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

  const uniqueBrands =
    [
      ...new Set(
        products
          .map((p) => p.brand)
          .filter((b) => !!b)
      ),
    ]

  const uniqueProductNames =
    [
      ...new Set(
        products
          .map((p) => p.product_name)
          .filter((n) => !!n)
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

          const searchLower = search.toLowerCase()

          const matchesSearch =
            !search ||
            product.product_name
              ?.toLowerCase()
              .includes(searchLower) ||
            product.barcode
              ?.includes(search) ||
            product.brand
              ?.toLowerCase()
              .includes(searchLower) ||
            product.category
              ?.toLowerCase()
              .includes(searchLower) ||
            product.shade
              ?.toLowerCase()
              .includes(searchLower)

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

  const reorderPointById: Record<string, number> = {}

  topSellingProducts.forEach((p) => {
    reorderPointById[p.id] = p.reorderPoint
  })

  function productGroupKey(p: any) {

    return [
      (p.product_name || '').trim().toLowerCase(),
      (p.brand || '').trim().toLowerCase(),
      (p.category || '').trim().toLowerCase(),
    ].join('|')

  }

  const productGroupsMap: Record<string, any> = {}

  filteredProducts.forEach((p) => {

    const key = productGroupKey(p)

    if (!productGroupsMap[key]) {

      productGroupsMap[key] = {
        key,
        productName: p.product_name,
        category: p.category,
        brand: p.brand,
        image: p.image_url,
        variants: [],
      }

    }

    if (!productGroupsMap[key].image && p.image_url) {
      productGroupsMap[key].image = p.image_url
    }

    productGroupsMap[key].variants.push(p)

  })

  const productGroups = Object.values(productGroupsMap)
    .map((g: any) => {

      const totalStock = g.variants.reduce(
        (s: number, v: any) => s + Number(v.current_stock || 0),
        0
      )

      const totalValue = g.variants.reduce(
        (s: number, v: any) => s + Number(v.cost_price || 0) * Number(v.current_stock || 0),
        0
      )

      return { ...g, totalStock, totalValue }

    })
    .sort((a: any, b: any) => (a.productName || '').localeCompare(b.productName || ''))

  const totalStockValue =
    products.reduce(
      (sum, item) =>
        sum + Number(item.cost_price || 0) * Number(item.current_stock || 0),
      0
    )

  const totalUnitsInStock =
    products.reduce(
      (sum, item) => sum + Number(item.current_stock || 0),
      0
    )

  const productsInStockCount =
    products.filter((p) => Number(p.current_stock || 0) > 0).length

  const outOfStockCount =
    products.filter((p) => Number(p.current_stock || 0) <= 0).length

  const lowStockCount =
    topSellingProducts.filter(
      (p) => p.current_stock > 0 && p.current_stock <= p.reorderPoint
    ).length

  const uniqueProductGroupCount = new Set(
    products.map((p) =>
      [
        (p.product_name || '').trim().toLowerCase(),
        (p.brand || '').trim().toLowerCase(),
        (p.category || '').trim().toLowerCase(),
      ].join('|')
    )
  ).size

  const showScanUI =
    mode !== 'ADD' || stockSessionActive

  return (

    <div className="text-black">

      <datalist id="categories">

        {uniqueCategories.filter((c) => !!c).map((cat, index) => (

          <option key={index} value={cat} />

        ))}

      </datalist>

      <datalist id="brands">

        {uniqueBrands.map((b, index) => (

          <option key={index} value={b} />

        ))}

      </datalist>

      <datalist id="productNames">

        {uniqueProductNames.map((n, index) => (

          <option key={index} value={n} />

        ))}

      </datalist>

      <div className="max-w-7xl mx-auto space-y-6">

        {/* OVERVIEW */}

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-5">

            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">

              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" strokeLinejoin="round" />
                <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" strokeLinejoin="round" />
              </svg>

            </div>

            <p className="text-xs text-zinc-500">Total Stock Value</p>
            <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-zinc-900">Rs. {totalStockValue.toLocaleString('en-IN')}</p>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-5">

            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">

              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M3 11h18M9 7V5a3 3 0 0 1 6 0v2" />
              </svg>

            </div>

            <p className="text-xs text-zinc-500">Total Units in Stock</p>
            <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-zinc-900">{totalUnitsInStock.toLocaleString('en-IN')}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{productsInStockCount} products carry stock</p>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-5">

            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center mb-3">

              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <rect x="4" y="4" width="12" height="12" rx="2" />
                <path d="M8 16v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2" />
              </svg>

            </div>

            <p className="text-xs text-zinc-500">Unique Products</p>
            <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-zinc-900">{uniqueProductGroupCount}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{products.length} variants total (by name, brand &amp; category)</p>

          </div>

          <button
            onClick={() => router.push('/low-stock')}
            className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-5 text-left hover:bg-zinc-50 transition-colors"
          >

            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3">

              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <path d="M12 9v4" strokeLinecap="round" />
                <path d="M12 17h.01" strokeLinecap="round" />
                <path d="M10.3 3.9L2.5 18a1 1 0 0 0 .9 1.5h17.2a1 1 0 0 0 .9-1.5L13.7 3.9a1 1 0 0 0-1.8 0z" strokeLinejoin="round" />
              </svg>

            </div>

            <p className="text-xs text-zinc-500">Low Stock Items</p>
            <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-amber-600">{lowStockCount}</p>

          </button>

          <button
            onClick={() => router.push('/low-stock')}
            className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-5 text-left hover:bg-zinc-50 transition-colors"
          >

            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mb-3">

              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
              </svg>

            </div>

            <p className="text-xs text-zinc-500">Out of Stock Items</p>
            <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums text-red-600">{outOfStockCount}</p>

          </button>

        </div>

        {/* SCANNER */}

        {!isViewer && (

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
                    disabled={finishingStockSession}
                    className="bg-green-600 hover:bg-green-700 transition-colors text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50"
                  >

                    {finishingStockSession ? 'Saving...' : 'Done'}

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

                    <div className="sm:col-span-2">

                      <label className="text-xs font-medium text-zinc-500 mb-1 block">Product Name</label>

                      <input
                        list="productNames"
                        placeholder="Product Name"
                        value={sessionNewProduct.name}
                        onChange={(e) => {

                          const name = e.target.value

                          const match = products.find(
                            (p) =>
                              p.product_name &&
                              p.product_name.toLowerCase() === name.toLowerCase()
                          )

                          if (match) {

                            setSessionNewProduct({
                              ...sessionNewProduct,
                              name,
                              category: match.category || '',
                              brand: match.brand || '',
                              weight: match.weight || '',
                              mrp: match.mrp != null ? String(match.mrp) : '',
                              costPrice:
                                match.cost_price != null
                                  ? String(match.cost_price)
                                  : sessionNewProduct.costPrice,
                            })

                          } else {

                            setSessionNewProduct({
                              ...sessionNewProduct,
                              name,
                            })

                          }

                        }}
                        className="w-full border-2 rounded-xl px-3 py-2.5 bg-white"
                      />

                      <p className="text-xs text-zinc-400 mt-1">

                        Pick an existing name to auto-fill Category, Brand, Weight, MRP &amp; Cost — you'll just need to add the Shade.

                      </p>

                    </div>

                    <div>

                      <label className="text-xs font-medium text-zinc-500 mb-1 block">Category</label>

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
                        className="w-full border-2 rounded-xl px-3 py-2.5 bg-white"
                      />

                    </div>

                    <div>

                      <label className="text-xs font-medium text-zinc-500 mb-1 block">Brand</label>

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
                        className="w-full border-2 rounded-xl px-3 py-2.5 bg-white"
                      />

                    </div>

                    <div>

                      <label className="text-xs font-medium text-zinc-500 mb-1 block">Shade</label>

                      <input
                        placeholder="Shade"
                        value={sessionNewProduct.shade}
                        onChange={(e) =>
                          setSessionNewProduct({
                            ...sessionNewProduct,
                            shade: e.target.value,
                          })
                        }
                        className="w-full border-2 rounded-xl px-3 py-2.5 bg-white"
                      />

                    </div>

                    <div>

                      <label className="text-xs font-medium text-zinc-500 mb-1 block">Weight</label>

                      <input
                        placeholder="Weight"
                        value={sessionNewProduct.weight}
                        onChange={(e) =>
                          setSessionNewProduct({
                            ...sessionNewProduct,
                            weight: e.target.value,
                          })
                        }
                        className="w-full border-2 rounded-xl px-3 py-2.5 bg-white"
                      />

                    </div>

                    <div>

                      <label className="text-xs font-medium text-zinc-500 mb-1 block">MRP</label>

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
                        className="w-full border-2 rounded-xl px-3 py-2.5 bg-white"
                      />

                    </div>

                    <div>

                      <label className="text-xs font-medium text-zinc-500 mb-1 block">Cost Price</label>

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
                        className="w-full border-2 rounded-xl px-3 py-2.5 bg-white"
                      />

                    </div>

                    <div>

                      <label className="text-xs font-medium text-zinc-500 mb-1 block">Quantity</label>

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
                        className="w-full border-2 rounded-xl px-3 py-2.5 bg-white"
                      />

                    </div>

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

        )}

        {/* INVENTORY */}

        <div className="bg-white rounded-[28px] shadow-xl border border-zinc-200 p-8 overflow-hidden relative">

          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">

            <div className="flex items-center gap-4">

              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-200">

                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="w-6 h-6"
                >

                  <path d="M3 7l9-4 9 4-9 4-9-4z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 7v10l9 4 9-4V7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 11v10" strokeLinecap="round" />

                </svg>

              </div>

              <div>

                <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">

                  Inventory Products

                </h2>

                <div className="flex flex-wrap items-center gap-2 mt-1.5">

                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">

                    {productGroups.length} {productGroups.length === 1 ? 'product' : 'products'}

                  </span>

                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-fuchsia-100 text-fuchsia-700">

                    {filteredProducts.length} {filteredProducts.length === 1 ? 'variant' : 'variants'}

                  </span>

                </div>

              </div>

            </div>

            <button
              onClick={exportToExcel}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-all text-white px-5 py-3 rounded-2xl font-bold self-start lg:self-auto shadow-lg shadow-green-200 flex items-center gap-2"
            >

              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-4 h-4"
              >

                <path d="M12 3v12" strokeLinecap="round" />
                <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 19h16" strokeLinecap="round" />

              </svg>

              Export Excel

            </button>

          </div>

          <div className="flex flex-wrap gap-3 items-center mb-6 bg-zinc-50 border border-zinc-200 rounded-2xl p-3">

            <div className="relative flex-1 min-w-[240px]">

              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400"
              >

                <circle cx="11" cy="11" r="7" />

                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />

              </svg>

              <input
                type="text"
                placeholder="Search product, brand, category or barcode"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-zinc-300 bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none rounded-xl pl-10 pr-4 py-2.5 text-sm"
              />

            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-zinc-300 bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none rounded-xl px-4 py-2.5 text-sm min-w-[160px] font-medium text-zinc-700"
            >

              <option value="ALL">All Categories</option>

              {uniqueCategories.map((cat, index) => (
                <option key={index} value={cat}>{cat}</option>
              ))}

            </select>

            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="border border-zinc-300 bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none rounded-xl px-4 py-2.5 text-sm min-w-[160px] font-medium text-zinc-700"
            >

              <option value="ALL">All Brands</option>

              {uniqueBrands.map((b, index) => (
                <option key={index} value={b}>{b}</option>
              ))}

            </select>

            {(search || selectedCategory !== 'ALL' || selectedBrand !== 'ALL') && (

              <button
                onClick={() => {
                  setSearch('')
                  setSelectedCategory('ALL')
                  setSelectedBrand('ALL')
                }}
                className="bg-white border border-zinc-300 text-zinc-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50"
              >

                Clear Filters

              </button>

            )}

          </div>

          {productGroups.length === 0 ? (

            <p className="text-zinc-500 text-sm">No products match this filter.</p>

          ) : (

            <div className="space-y-3">

              {productGroups.map((group: any) => {

                const isOpen = expandedGroups[group.key] !== false
                const isEmptyGroup = Number(group.totalStock || 0) <= 0

                return (

                  <div
                    key={group.key}
                    className={`border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border-l-4 ${isEmptyGroup ? 'border-l-red-400 border-zinc-200' : 'border-l-indigo-400 border-zinc-200'}`}
                  >

                    <button
                      onClick={() =>
                        setExpandedGroups((prev) => ({ ...prev, [group.key]: prev[group.key] === false }))
                      }
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-indigo-50/40 transition-colors text-left"
                    >

                      {group.image ? (

                        <img
                          src={group.image}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover border border-zinc-200 flex-shrink-0"
                        />

                      ) : (

                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-100 to-fuchsia-100 border border-zinc-200 flex items-center justify-center text-indigo-300 flex-shrink-0">

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

                      <div className="flex-1 min-w-0">

                        <p className="font-semibold text-zinc-900 truncate">{group.productName}</p>

                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">

                          {group.category && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700">
                              {group.category}
                            </span>
                          )}

                          {group.brand && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-fuchsia-100 text-fuchsia-700">
                              {group.brand}
                            </span>
                          )}

                          <span className="text-xs text-zinc-400">

                            {group.variants.length} {group.variants.length === 1 ? 'variant' : 'variants'}

                          </span>

                        </div>

                      </div>

                      <div className="text-right hidden sm:block flex-shrink-0">

                        <p className="text-xs text-zinc-500">Total Stock</p>
                        <p className={`font-bold tabular-nums ${isEmptyGroup ? 'text-red-600' : 'text-indigo-600'}`}>{group.totalStock}</p>

                      </div>

                      <div className="text-right hidden sm:block min-w-[110px] flex-shrink-0">

                        <p className="text-xs text-zinc-500">Total Value</p>
                        <p className="font-bold tabular-nums text-emerald-600">Rs. {group.totalValue.toLocaleString('en-IN')}</p>

                      </div>

                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`w-4 h-4 text-indigo-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      >

                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />

                      </svg>

                    </button>

                    {isOpen && (

                      <div className="border-t border-zinc-200 overflow-x-auto">

                        <table className="w-full border-collapse">

                          <thead>

                            <tr className="text-left bg-indigo-50/70">

                              <th className="py-2.5 px-5 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide">Barcode</th>
                              <th className="py-2.5 px-5 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide">Shade</th>
                              <th className="py-2.5 px-5 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide">Weight</th>
                              <th className="py-2.5 px-5 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">Cost</th>
                              <th className="py-2.5 px-5 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">MRP</th>
                              <th className="py-2.5 px-5 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">Stock</th>
                              <th className="py-2.5 px-5 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">Value</th>
                              {!isViewer && (
                                <th className="py-2.5 px-5 text-xs font-semibold text-indigo-900/70 uppercase tracking-wide text-right">Actions</th>
                              )}

                            </tr>

                          </thead>

                          <tbody className="divide-y divide-zinc-100">

                            {group.variants.map((product: any) => {

                              const reorderPoint = reorderPointById[product.id] ?? 0
                              const stockNum = Number(product.current_stock || 0)
                              const isOutOfStock = stockNum <= 0
                              const isLowStock = !isOutOfStock && stockNum <= reorderPoint

                              return (

                                <tr key={product.id} className="hover:bg-zinc-50 transition-colors">

                                  <td className="py-2.5 px-5 text-sm text-zinc-500">{product.barcode || '—'}</td>
                                  <td className="py-2.5 px-5 text-sm text-zinc-600">{product.shade || '—'}</td>
                                  <td className="py-2.5 px-5 text-sm text-zinc-600">{product.weight || '—'}</td>
                                  <td className="py-2.5 px-5 text-sm text-zinc-600 text-right tabular-nums">Rs. {product.cost_price}</td>
                                  <td className="py-2.5 px-5 text-sm text-zinc-600 text-right tabular-nums">{displayMrp(product.mrp) !== null ? `Rs. ${displayMrp(product.mrp)}` : '—'}</td>

                                  <td className="py-2.5 px-5 text-right tabular-nums">

                                    <span
                                      className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-full text-xs font-bold ${isOutOfStock
                                        ? 'bg-red-100 text-red-700'
                                        : isLowStock
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-emerald-100 text-emerald-700'
                                        }`}
                                    >

                                      {product.current_stock}

                                    </span>

                                  </td>

                                  <td className="py-2.5 px-5 font-bold text-emerald-700 text-right tabular-nums">

                                    Rs. {(Number(product.cost_price || 0) * Number(product.current_stock || 0)).toLocaleString('en-IN')}

                                  </td>

                                  {!isViewer && (
                                  <td className="py-2.5 px-5">

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
                                  )}

                                </tr>

                              )

                            })}

                          </tbody>

                        </table>

                      </div>

                    )}

                  </div>

                )

              })}

            </div>

          )}

        </div>

        {/* EDIT MODAL */}

        {editingProduct && (

          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">

            <div className="bg-white rounded-[32px] shadow-2xl border border-zinc-200 w-full max-w-lg max-h-[90vh] flex flex-col">

              <h2 className="text-2xl sm:text-3xl font-bold px-6 sm:px-8 pt-6 sm:pt-8 pb-4 flex-shrink-0">

                Edit Product

              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 sm:px-8 overflow-y-auto">

                <div className="sm:col-span-2">

                  <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Barcode</label>

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

                </div>

                <div className="sm:col-span-2">

                  <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Product Name</label>

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

                </div>

                <div>

                  <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Category</label>

                  <input
                    type="text"
                    list="categories"
                    value={editCategory}
                    onChange={(e) =>
                      setEditCategory(
                        e.target.value
                      )
                    }
                    placeholder="Category"
                    className="w-full border-2 rounded-2xl px-4 py-4"
                  />

                </div>

                <div>

                  <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Brand</label>

                  <input
                    type="text"
                    list="brands"
                    value={editBrand}
                    onChange={(e) =>
                      setEditBrand(
                        e.target.value
                      )
                    }
                    placeholder="Brand"
                    className="w-full border-2 rounded-2xl px-4 py-4"
                  />

                </div>

                <div>

                  <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Shade</label>

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

                </div>

                <div>

                  <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Weight</label>

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

                </div>

                <div>

                  <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Cost</label>

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

                </div>

                <div>

                  <label className="text-xs font-medium text-zinc-500 mb-1.5 block">MRP</label>

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

                </div>

                <div>

                  <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Stock</label>

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

                </div>

                <div className="sm:col-span-2 pb-6 sm:pb-8">

                  <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Image</label>

                  {editImage && (

                    <img
                      src={editImage}
                      alt=""
                      className="w-32 h-32 rounded-2xl object-cover border mb-3"
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

              </div>

              <div className="flex gap-4 px-6 sm:px-8 py-5 border-t border-zinc-200 flex-shrink-0">

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
