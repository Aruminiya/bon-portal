export interface PortalProduct {
  name: string
  url: string
}

// VITE_PORTAL_PRODUCTS 是逗號分隔的純 URL（沒有另外的名稱欄位）——顯示名稱
// 直接取 URL 的 host（例如 "bonsale.company.com"）。每一筆各自驗證，所以
// 一筆設錯只會讓那一筆消失，不會讓整份清單變空。
export function getPortalProducts(): PortalProduct[] {
  const raw = import.meta.env.VITE_PORTAL_PRODUCTS
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      try {
        return [{ name: new URL(entry).host, url: entry }]
      } catch {
        return []
      }
    })
}
