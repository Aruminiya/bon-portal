# Proposal

## Why

bon-portal 是**合約制**的客戶入口:客戶簽了什麼就能用什麼,每個客戶買的東西不一樣。但目前的產品清單是**一份全域清單**(`VITE_PORTAL_PRODUCTS`,建置時燒進產物),所有客戶登入後看到的連結完全相同 —— 只買了 BonSale 的客戶也會看到 BonTalk 和 BonAI。

「誰買了什麼」這份資料本來就在 Authentik 裡(簽約後由業務在後台建立帳號並設定該客戶的群組),不需要另外做一套。缺的只是讓它跟著 `id_token` 回到前端。

同時,把「產品有哪些、叫什麼、網址是什麼」放在環境變數裡本來就不合適:那是**對所有客戶都一樣的資料**,應該進版控、該有型別、該能寫註解。現在它是一串逗號分隔的字串,需要一整套防禦性解析來防止一筆打錯害死整份清單,而且值裡的逗號還逼得 Cloud Run 部署要用 `^@^` 自訂分隔符。

原則是:**每個客戶不一樣的資料放 Authentik,所有人都一樣的資料放 repo。**

## What Changes

- **新增** `src/products.ts`:型別化的產品目錄(`key` / `name` / `url`),`key` 對應 Authentik 的產品群組名。顯示名稱改為明寫(客戶看到「BonSale」而不是 `bonsale.bonvies.com`)。本機與正式環境的網址以 `import.meta.env.DEV` 切換。
- **BREAKING** — 移除 `VITE_PORTAL_PRODUCTS`。產品目錄不再是部署設定,改為程式碼的一部分。
- **刪除** `src/utils/portalProducts.ts`:逗號分隔字串的解析與逐筆 `try/catch` 防護不再需要 —— 型別化陣列裡打錯 URL 是 code review 看得到、git 歷史查得到的事。
- **新增** 依授權過濾:Authentik 透過新的 `products` scope 回傳**已歸納到產品層級**的授權清單,前端拿它跟產品目錄取交集。
- **新增** 授權資訊缺漏的三態處理:claim 不存在(設定錯誤)、`[]`(確實沒有產品)、有值 —— 三者的畫面必須分開,設定錯誤不能看起來像「你沒有買任何東西」。
- **可選、可拆** — `VITE_AUTHENTIK_REDIRECT_URI` 與 `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` 改由 `window.location.origin` 推導,設定項從 4 個降到 2 個。

**Portal 之外**:Authentik 需要新增一個 `products` 的 Scope Mapping 並掛到 provider 上。步驟已寫在 `docs/authentik-product-entitlements.md`,以檢查清單形式列在 tasks。

## Capabilities

### New Capabilities

(無 —— 本 change 修改既有能力,不引入新的。)

### Modified Capabilities

- `product-launcher`:產品清單的來源從部署設定改為程式碼目錄;新增「依登入者的授權過濾」與「授權資訊缺漏的三態」兩條需求;移除「單筆設定錯誤不得讓整份清單消失」(該需求存在的前提是手打字串,前提消失)。
- `deployment-config`:設定項減少(移除服務清單;若採用可選項則再移除兩個 redirect URI),「缺少服務清單」不再是建置時要考慮的狀態。

> **歸檔順序**:這兩個 capability 目前只存在於 `rebuild-portal-as-vite-launcher` 的 delta 中,`openspec/specs/` 仍是空的。**本 change 必須在該 change 歸檔之後才能歸檔**,否則 MODIFIED / REMOVED 會找不到對應的既有需求。

## Impact

**新增**:`src/products.ts`。

**刪除**:`src/utils/portalProducts.ts`。

**修改**:`src/App.tsx`(過濾與三態)、`src/config/oidc.ts`(scope 加 `products`;採用可選項的話 redirect URI 改推導)、`src/vite-env.d.ts`(少 1 個或 3 個設定項)、`Dockerfile`(少 1 個或 3 個 ARG)、`.env` / `.env.example`。

**文件**:`CLAUDE.md` 與 `README.md` 的設定段落;`docs/authentik-product-entitlements.md` 的狀態標示(從「尚未實作」改為現況)。

**部署**:Cloud Run 不再需要 `^@^` 自訂分隔符(那是為了產品清單裡的逗號才存在的)。

**不在此 change**:錯誤訊息客戶化(把 `oidc-client-ts` 的原始錯誤字串降級為次要資訊)、i18n、測試與 CI。
