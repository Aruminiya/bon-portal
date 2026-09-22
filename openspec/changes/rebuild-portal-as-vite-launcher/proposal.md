# Proposal

## Why

bon-portal 目前是一個**純 SPA 外面套了一層 Next.js 的殼**:8 個頁面/元件全部標了 `"use client"`,唯一的 server component 是 `app/layout.tsx`,而它做的事只有載字體與包一個 theme provider —— 兩件都不需要伺服器。

這層殼不是免費的。程式碼裡有兩處註解在處理純粹由 SSR 造成的問題(`NavBar.tsx:14-17` 為了伺服器端讀不到 sessionStorage 而讓 `useSyncExternalStore` 第三參數回 `undefined`;`login/success/page.tsx:29-32` 為了靜態預渲染而先渲染佔位畫面再用 effect 更新),而 `AGENTS.md` 開頭那句「This is NOT the Next.js you know」本身就是維護摩擦的證據。

同時,Portal 的定位要依 **Decision O**(收斂為登入中控)與 **Decision P**(登入由 SPA 直接對 Authentik)從「token 轉交」改成「純 launcher」。既然登入層本來就要整段重寫,現在是換掉框架成本最低的時刻 —— 而且參考實作 `~/Desktop/Program/Demo/authentik/code/authentik-react-demo-app`(下稱 **demo**)已經是一個做完的 Vite + React launcher:`react-oidc-context` 接線、runtime env 注入、產品清單、Authentik 登出繞道、Dockerfile、nginx.conf、entrypoint 腳本全都在,而且跑過 portal + 三個產品的完整 SSO 情境。

這次改動因此不是「把 bon-portal 從 Next.js 移植到 Vite」,而是**以 demo 為基底重建 bon-portal**:大部分工作是刪掉 demo 的示範內容、搬進 bon-portal 的外觀。

已確認公司內部技術棧本來就雜,只有一個專案用 Next.js,所以沒有「統一技術棧」的理由要保留它。下游三個團隊(BonSale / BonTalk / BonAI)尚未動工,沒有在途工作要撤回。

## What Changes

- **BREAKING** — 框架從 Next.js 16(App Router)換成 **Vite + React**。`app/`、`next.config.ts`、`next-env.d.ts`、`eslint-config-next`、`@mui/material-nextjs`、`PageProps`/`LayoutProps` 生成型別全部退場,改為 `index.html` + `src/` 的 SPA 結構。產物從 Node server 變成靜態檔,容器從 Node 換成 nginx。
- **BREAKING** — 移除 token 轉交:`lib/redirect.ts`(整支)、`/login`、`/login/success` 全部刪除。`?redirect_uri=<url>` 這個對外入口與 `#token=` 交付格式一併消失。
- **BREAKING** — 移除 `NEXT_PUBLIC_ALLOWED_REDIRECT_HOSTS`:白名單只為轉交存在。
- **BREAKING** — 環境變數改名為 demo 的 `VITE_*` 系列。前綴不能省 —— Vite 的 `import.meta.env` 只會曝露 `VITE_` 開頭的變數,而那是本機開發時的 fallback 來源。
- 手寫 OIDC 全部退場(`lib/pkce.ts`、`lib/authentik.ts` 的登入與 token 解析),改用 demo 已驗證的 `react-oidc-context` + `oidc-client-ts`。隨之取得 `nonce` 驗證、discovery、`offline_access` + silent renew。
- **保留** Authentik 登出繞道(`/flows/-/cancel/`)。demo 的 `src/utils/authentikLogout.ts` 與 bon-portal 的 `lib/authentik.ts:171-188` 是同一個繞道的兩份實作,採用 demo 版(它從 discovery 取 `end_session_endpoint`,少一個設定值)。
- 新增產品清單:首頁的三張純文案卡片換成 `VITE_PORTAL_PRODUCTS` 解析出的產品連結。
- 設定改為**建置時燒進產物**:`Dockerfile` 的 `ARG` 提供值,Vite 在建置時替換成字面值。**不採用** demo 的執行時注入(entrypoint 產生 `/env-config.js` → `window.__ENV__`)—— 那是為了「一份 image 跑四個容器」而存在的,Portal 只有一個部署,用不到。
- **保留 bon-portal 的外觀**:`lib/theme.ts` 的 Bonvies 色票、NavBar 與首頁的視覺,搬進新結構。
- **順帶補齊基礎建設**:Dockerfile、nginx.conf、entrypoint 從 demo 取得(原本是 MIGRATION-PLAN 階段 6 的獨立工作,現在因為基底自帶而免費)。

## Capabilities

### New Capabilities

- `portal-session`:Portal 自身的登入 / 登出 / session 狀態 —— 對 Authentik 跑 OIDC Authorization Code + PKCE、token 續期、以及帶 `id_token_hint` 的完整 SLO 登出(含 Authentik 空白頁 bug 的繞道)。
- `product-launcher`:登入後呈現可進入的產品清單,以及「不轉交任何憑證」這條邊界 —— 產品連結是普通同分頁連結,由產品自己補完登入。
- `deployment-config`:設定在建置時決定並寫進產物、本機開發設定不得洩漏進正式產物、必要設定缺漏時建置必須失敗、以及「具名存取、集中宣告」這條約束。

### Modified Capabilities

(無 —— `openspec/specs/` 目前是空的,這是本專案第一份 spec。)

## Impact

**整個刪除**:`app/`(4 個頁面 + layout)、`components/`(4 支)、`lib/authentik.ts`、`lib/pkce.ts`、`lib/redirect.ts`、`next.config.ts`、`next-env.d.ts`、`eslint.config.mjs`。

**保留內容、換位置**:`lib/theme.ts` → `src/theme.ts`(Bonvies 色票不變);NavBar 與首頁的視覺搬進新元件。

**從 demo 取得**:`index.html`、`vite.config.ts`、`src/main.tsx`、`src/config/oidc.ts`、`src/utils/authentikLogout.ts`、`src/utils/portalProducts.ts`、`src/components/FullscreenState.tsx`、`Dockerfile`、`nginx.conf`。

**從 demo 取得但刻意不採用**:`src/config/runtimeEnv.ts`、`public/env-config.js`、`docker-entrypoint.d/40-generate-env-config.sh` —— 執行時注入那一整套(理由見 design.md D16)。

**從 demo 取得但要刪掉的示範內容**:`TokenPanel.tsx`(101 行)、`TokenExpiry.tsx`、`utils/jwt.ts`、`DashboardPage.tsx` 的示範卡片(248 行中的大部分)、「群組與權限」示範、`VITE_DEMO_APP_*` / `VITE_THEME_COLOR` / `VITE_AUTHENTIK_ENROLLMENT_URL` 這幾個 demo 專用變數。

**相依變動**:`+ vite`、`+ @vitejs/plugin-react`、`+ react-oidc-context`、`+ oidc-client-ts`;`- next`、`- eslint-config-next`、`- @mui/material-nextjs`。

**文件**:`CLAUDE.md` 與 `AGENTS.md` 要重寫 —— `AGENTS.md` 那段 Next.js 警告連同它的生成機制一起消失。

**Portal 之外**:Authentik 的 `bon-portal-app` provider 需要先改好(redirect URI 對齊新的 port 與路徑、issuer 改用正式 host、加 `offline_access` scope mapping、綁 `default-invalidation-flow`)。那是本 change 的**前置條件**,以檢查清單形式列在 tasks。

**不在此 change**:測試與 CI(`.github/workflows/`)。基底自帶 Dockerfile 讓容器化免費了,但測試 demo 也沒有,維持另開一個 change。
