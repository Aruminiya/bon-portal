# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server,固定 port 6030(`strictPort`,被占用時直接失敗)
- `npm run build` — `tsc -b` 型別檢查後 `vite build`,產物在 `dist/`
- `npm run preview` — 預覽 build 產物
- `npm run lint` — oxlint

沒有測試框架(計畫中會用 Vitest,見 `openspec/changes/` 的規劃)。

## What this app is

提供給**簽約客戶**的服務登入入口(launcher)—— 前端 only,身分由自架的 [Authentik](https://goauthentik.io/) 提供,這個 repo 裡沒有任何後端。

**不是**內部員工工具,也**不是**行銷網站(行銷另有站點)。帳號不開放自助註冊:業務簽約後,由我們在 Authentik 預先建立帳號並設定該客戶可用的服務,客戶在合約期間內使用。沒有 free trial、沒有線上結帳 —— 報價與收款走合約流程,不經過這個 app。

流程只有兩件事:

1. 客戶在 Portal 登入 → 建立起 Authentik 的 SSO session(`authentik_session` cookie)
2. 客戶點首頁的產品連結 → 該產品**自己**跑一次 OIDC,靠那個 cookie 靜默完成登入

**Portal 全程不碰產品的 token。** 這是刻意的責任邊界:Portal 不是憑證的中繼站,各產品自己對 Authentik 負責。舊版曾經把 `id_token` 放在網址 fragment 交給下游服務(`#token=`),那套已經整個移除,連帶移除了為它存在的 open-redirect 網域白名單。

### 登入

`react-oidc-context` + `oidc-client-ts` 處理 Authorization Code + PKCE,包含 `nonce` 與 refresh。設定在 `src/config/oidc.ts`:

- **`authority` 一個值就夠** —— endpoint 由 `<authority>/.well-known/openid-configuration` 取得
- **`redirect_uri` 指向首頁 `/`**,沒有獨立的 callback 路由。`oidc-client-ts` 偵測到網址帶 `code`/`state` 就自動完成交換,`onSigninCallback` 負責把它們從網址列抹掉
- **`offline_access` 不是裝飾**:少了它拿不到 refresh token,而 `react-oidc-context` 的 `isAuthenticated` 是 `user && !user.expired` —— access token 一過期(預設 5 分鐘)登出按鈕就會消失,使用者做不了 SLO。Authentik 會靜默把未設定的 scope 交集掉不報錯,所以要用 discovery 的 `scopes_supported` 驗,不能靠「本機看起來正常」

### 登出

`src/utils/authentikLogout.ts` 的 `signoutWithCancelBounce()`。**不要改成 `auth.signoutRedirect()`** —— 那會繞不過 Authentik 2026.8.0 的一個真 bug:session 裡殘留未完成的 flow plan 時,`EndSessionView.dispatch()` 回一個 body 全空的 200,而殘留幾乎每次登出後都會發生。解法是先繞去 Authentik 的 CancelView 清掉殘留再進 end-session。那段註解解釋了完整成因,不要刪。

呼叫順序有講究(見 `AuthentikLogoutButton.tsx`):取 `id_token` → `removeUser()` → 導向。少了中間那步,使用者登出後導回 Portal 會看到假的「已登入」狀態。

`post_logout_redirect_uri` 與 `redirect_uri` 在 Authentik 都是**字串完全比對**,連結尾斜線都算不同。這裡統一用帶尾斜線的首頁。

### 路由

**沒有 router。** Portal 只有一個畫面,依 `useAuth()` 切換:`isLoading` → 載入中、未登入 → 登入按鈕、已登入 → 產品清單。

任何其他路徑由 nginx 的 `try_files` 回 `index.html`,再由 `src/main.tsx` 開頭兩行把網址列收回 `/`。

### 設定

**五個 `VITE_*` 變數,沒有一個是機密**(client_id 會明文出現在授權請求的網址上;其餘都是網址)。Portal 是 public client,沒有 client secret。

設定在 **build 時**就被 Vite 換成字面值寫進產物 —— 一個 image 對應一個環境,換設定要重新 build。這是刻意的:Portal 只有一個部署,而重 build 不到一秒、push 的只有變動的那層;何況在 Cloud Run 上改環境變數本來就會產生一個新 revision,也是一次部署,所以執行時注入並沒有省掉那一步。

- **本機開發** 讀 `.env`
- **build image** 由 `Dockerfile` 的 `ARG` 提供,`.env` 被 `.dockerignore` 擋在外面 —— 否則忘記改就會把 `localhost:9000` 安靜地燒進正式版的 image
- **必要參數缺漏時 build 會直接失敗**,不會產出一個「跑得起來但登入必壞」的 image

**規則:一律用具名存取 `import.meta.env.VITE_XXX`,不要用動態 key(`import.meta.env[key]`)。** 具名存取 Vite 只會替換掉那一個值;動態存取會讓它把**整個 env 物件**塞進 bundle,連你沒打算曝露的變數都會進去。所有變數都要在 `src/vite-env.d.ts` 宣告,那份宣告就是設定的單一清單。

稽核:

```bash
grep -rn "import.meta.env" src/          # 應該只有具名存取,沒有 [key]
grep -o 'VITE_[A-Z_]*' dist/assets/*.js  # build 後不該出現變數名(UI 文案除外)
```

## Conventions

- UI 文案與程式碼註解用繁體中文(zh-TW)。
- 註解寫「為什麼」,尤其是那些看起來可以簡化、但簡化了就會壞的地方(登出繞道、`offline_access`、`runtimeEnv` 的單一入口)。那些都是踩過坑才長出來的。
- 參考實作在 `~/Desktop/Program/Demo/authentik/code/authentik-react-demo-app` —— 這個 repo 以它為基底重建。動 OIDC / 登出 / runtime env 之前先去對照。
