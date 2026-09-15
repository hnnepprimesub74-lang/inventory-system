export type PurchaseOrderDraftItem = {
  id: string
  product_name: string
  category: string
  brand: string
  shade: string
  current_stock: number
  reorderPoint: number
  suggestedQty: number
  costPrice: number
}

const KEY = 'purchaseOrderDraft'

export function savePurchaseOrderDraft(items: PurchaseOrderDraftItem[]) {

  sessionStorage.setItem(KEY, JSON.stringify(items))

}

export function loadPurchaseOrderDraft(): PurchaseOrderDraftItem[] {

  try {

    const raw = sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []

  } catch {

    return []

  }

}

export function clearPurchaseOrderDraft() {

  sessionStorage.removeItem(KEY)

}
