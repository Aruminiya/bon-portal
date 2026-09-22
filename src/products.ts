// Portal 的產品目錄。
//
// 這份資料對「所有客戶都一樣」，所以它屬於程式碼而不是部署設定 —— 它需要型別、
// 需要註解、需要進版控，逗號分隔的環境變數三者都給不了。
//
// 「哪個客戶買了哪些產品」則相反，那是每個客戶都不同的資料，唯一來源是 Authentik
// （簽約後由業務在後台設定群組）。Portal 不維護任何副本，只拿 Authentik 回傳的
// 授權清單跟這份目錄取交集。

export type Product = {
  /** 對應 Authentik 的產品層級群組名（例如 bonsale）。 */
  key: string
  /** 給客戶看的名稱。刻意明寫而不是從網址推導 —— 客戶該看到「BonSale」而不是 host。 */
  name: string
  /** 該產品的入口網址。就是入口路徑本身，不附加任何參數。 */
  url: string
}

// 本機開發指向 demo 的三個假產品容器（Demo/authentik/code/authentik-react-demo-app
// 的 docker-compose），正式環境指向真網域。用 Vite 內建的 DEV 旗標切換，不需要
// 任何額外設定，也不必把網址變回設定項。
//
// 代價是「本機看到的清單」跟「正式環境看到的」本來就不同 —— 要驗正式環境的清單
// 只能在正式環境，或用 npm run build && npm run preview。
export const PRODUCTS: Product[] = import.meta.env.DEV
  ? [
      { key: 'bonsale', name: 'BonSale', url: 'http://localhost:6175/dashboard' },
      { key: 'bontalk', name: 'BonTalk', url: 'http://localhost:6176/dashboard' },
      { key: 'bonai', name: 'BonAI', url: 'http://localhost:6177/dashboard' },
    ]
  : [
      // TODO: 正式網域上線前要確認，並與各產品在 Authentik 的 provider 設定對齊。
      { key: 'bonsale', name: 'BonSale', url: 'https://bonsale.bonvies.com' },
      { key: 'bontalk', name: 'BonTalk', url: 'https://bontalk.bonvies.com' },
      { key: 'bonai', name: 'BonAI', url: 'https://bonai.bonvies.com' },
    ]

// Authentik 回傳的 products claim 有三種狀態，混為一談會讓「我們設定錯了」長得像
// 「這位客戶沒有買任何東西」—— 對付費客戶來說那是完全不同的兩件事，而且第一種的
// 正確反應是聯繫我們，第二種不是。
export type Entitlements =
  | { status: 'missing' }
  | { status: 'none' }
  | { status: 'ok'; products: Product[] }

/**
 * 把 Authentik 的 products claim 轉成畫面要用的三態。
 *
 * claim 不是陣列就算 missing —— 包含「完全沒有這個欄位」（scope mapping 沒建或
 * 沒掛到 provider，Authentik 兩種都不會報錯）以及「型別不對」（mapping 的
 * expression 寫錯）。兩者都是我們這邊的設定問題，不是客戶的狀態。
 *
 * 對不上任何產品的授權項目會被忽略 —— Authentik 裡的內部群組（staff 之類）也會
 * 被歸納進這個 claim，取交集就自然過濾掉了，不需要在 Authentik 端另外維護名單。
 */
export function readEntitlements(claim: unknown): Entitlements {
  if (!Array.isArray(claim)) return { status: 'missing' }

  const keys = claim.filter((value): value is string => typeof value === 'string')
  const products = PRODUCTS.filter((product) => keys.includes(product.key))

  // 有授權但一個都對不上產品（例如只有內部群組），對客戶來說跟「沒有授權」是
  // 同一件事：沒有可以進去的服務。
  return products.length > 0 ? { status: 'ok', products } : { status: 'none' }
}
