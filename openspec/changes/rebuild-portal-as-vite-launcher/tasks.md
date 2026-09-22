# Tasks

> `DEMO` = `~/Desktop/Program/Demo/authentik/code/authentik-react-demo-app`

## 1. 前置:Authentik provider 設定(本 repo 之外,需在改程式前完成)

- [ ] 1.1 把 `bon-portal-app` provider 的 redirect URI 改成 **`http://localhost:6030/`**(含尾斜線;現註冊值是 `http://localhost:6174/auth/authentik/callback`,path 與 port 都不同),確認已儲存
- [ ] 1.2 註冊 logout redirect URI(type=logout、matching mode=strict),值同樣是 **`http://localhost:6030/`**,與 1.1 逐字相同
- [ ] 1.3 為該 provider 勾上 `offline_access` scope mapping(獨立的一筆 mapping,要手動勾選)
- [ ] 1.4 把該 provider 的 invalidation flow 綁成 `default-invalidation-flow`(含 `UserLogoutStage`,完整 SLO);確認**沒有**修改那條共用 default flow 本身
- [ ] 1.5 確認 issuer 使用正式 host(依 Decision K),並理解此值一經確定不可再改(見 design.md Risks)
- [ ] 1.6 以 `curl -s <authority>/.well-known/openid-configuration | jq '{issuer, scopes_supported, end_session_endpoint}'` 驗收:`issuer` 逐字等於要設定的 `VITE_AUTHENTIK_AUTHORITY`、`scopes_supported` 含 `offline_access`、`end_session_endpoint` 有值(D5 要靠它)

## 2. 建立 Vite 骨架(一次換乾淨,中間狀態不求可用)

- [x] 2.1 刪除 Next.js 相關檔案:`app/`(整個目錄)、`next.config.ts`、`next-env.d.ts`、`eslint.config.mjs`、`components/`(整個目錄,視覺會在第 5 組重建)。驗證:`git status` 顯示這些檔案已刪除
- [x] 2.2 改寫 `package.json`:移除 `next` / `eslint-config-next` / `@mui/material-nextjs` / `eslint`,加入 `vite` / `@vitejs/plugin-react` / `oidc-client-ts` / `react-oidc-context` / `oxlint`,版本照 `DEMO/package.json`(D11);`scripts` 改成 `dev: vite` / `build: tsc -b && vite build` / `lint: oxlint` / `preview: vite preview`;加上 `"type": "module"`。驗證:`npm install` 成功
- [x] 2.3 從 `DEMO` 取得 `index.html`,改 `<title>` 為「Bon Portal 服務入口」,**保留 `/env-config.js` 那個 script 標籤與它上方的註解**(順序保證是它存在的理由),移除 `htmlTitlePlugin` 相關的部分
- [x] 2.4 建立 `vite.config.ts`:`plugins: [react()]`、`server: { port: 6030, strictPort: true }`(D12),**不含** demo 的 `htmlTitlePlugin`(那是給 `VITE_DEMO_APP_NAME` 用的,不移植)
- [x] 2.5 改寫 `tsconfig.json` 對齊 `DEMO`(含 `src/vite-env.d.ts` 的 `ImportMetaEnv` 型別宣告,變數名換成本專案的五個)。驗證:`npx tsc -b` 無錯誤
- [x] 2.6 更新 `.gitignore`:`/.next/` 與 `/out/` 換成 `/dist`

## 3. 設定層(建置時燒進產物,見 design.md D16)

- [x] 3.1 在 `src/vite-env.d.ts` 宣告五個設定項的 `ImportMetaEnv` 型別,並在註解寫明「具名存取、不可用動態鍵值」的理由。這份宣告就是設定的完整清單
- [x] 3.2 建立 `.env`(本機開發用)與 `.env.example`,五個變數附 zh-TW 說明註解;刪除舊的 `.env.local` 與 `.env.local.example`。驗證:`npm run dev` 起得來
- [x] 3.3 `.dockerignore` 把 `.env` 擋在 build context 外,並在註解寫明理由(否則本機的 `localhost:9000` 會被燒進正式版 image)
- [x] 3.4 **不採用** demo 的執行時注入 —— 不建立 `src/config/runtimeEnv.ts`、`public/env-config.js`、`docker-entrypoint.d/`,`index.html` 也不加 `/env-config.js` 的 script 標籤(D16)
- [x] 3.5 稽核具名存取:`grep -rn "import.meta.env" src/` 全部是 `import.meta.env.VITE_XXX` 形式,沒有 `[key]`

## 4. OIDC 接線

- [x] 4.1 從 `DEMO/src/config/oidc.ts` 取得設定,`scope` 改成寫死的 `"openid profile email offline_access"`(不移植 `VITE_AUTHENTIK_SCOPE`),`postLogoutRedirectUri` 的 fallback 維持 `window.location.origin + '/'`(D7)。驗證:`npx tsc -b` 無錯誤
- [x] 4.2 建立 `src/main.tsx`:`StrictMode` → `ThemeProvider` + `CssBaseline` → `AuthProvider` → `App`,**不含** `BrowserRouter`(D2),也不含 demo 的 `document.title` 覆寫
- [ ] 4.3 在 `main.tsx` 加入網址正規化(D2):啟動時若 `window.location.pathname !== "/"` 就 `history.replaceState({}, "", "/")`,並加註解說明它取代了 router 的 catch-all。驗證:開 `/login` 會落在首頁且網址列變成 `/`
- [ ] 4.4 驗證登入流程:點登入 → 導向 Authentik → 回來後網址列不含 `code`/`state`、畫面顯示已登入。用 devtools 確認授權請求含 `code_challenge_method=S256`、`state`、`nonce`
- [x] 4.5 刪除 `lib/authentik.ts` 與 `lib/pkce.ts`。驗證:`grep -rn "createPkcePair\|completeAuthentikLogin\|decodeAndVerifyIdToken\|rememberIdTokenForLogout" .` 在 `node_modules` 外零命中

## 5. 登出與外觀

- [x] 5.1 從 `DEMO/src/utils/authentikLogout.ts` 取得 `signoutWithCancelBounce`,**連同解釋 Authentik 空白頁 bug 成因的 8 行註解一字不改**,變數名改成本專案的(D5)
- [x] 5.2 把 `lib/theme.ts` 搬成 `src/theme.ts`,Bonvies 色票不變;**不移植** demo 的 `VITE_THEME_COLOR` 多色切換(D9)。驗證:首頁配色與現行版本一致
- [x] 5.3 從 `DEMO/src/components/FullscreenState.tsx` 取得載入/錯誤畫面元件,移除其中對 `react-router` 的 `Link` 依賴(D2)
- [ ] 5.4 重建 `src/components/NavBar.tsx`:保留現行的圓形 B logo 與版面,登入狀態改讀 `useAuth()`,**把「狀態未定」(`auth.isLoading`)與「已確定未登入」分開**(沿用現行 `NavBar.tsx:14-17` 的意圖)。驗證:已登入時重新整理,登入按鈕不會先閃一下
- [ ] 5.5 建立登入 / 登出按鈕元件:登入呼叫 `auth.signinRedirect()`;登出照 D6 的順序 —— 取 `auth.user?.id_token` → `await auth.removeUser()` → `signoutWithCancelBounce(...)`。驗證:登出後導回 Portal 時顯示為**未登入**
- [ ] 5.6 驗證繞道仍有效:連續登出兩次(第二次是殘留 flow plan 最容易發生的時機),兩次都正常導回,不得出現空白的 HTTP 200 頁面

## 6. 產品清單與首頁

- [ ] 6.1 從 `DEMO/src/utils/portalProducts.ts` 取得解析函式(逐筆 try/catch、名稱取 host),變數名改成 `VITE_PORTAL_PRODUCTS`。驗證:設成 `https://a.example.com,not-a-url,https://c.example.com` 時顯示兩筆而非空清單
- [ ] 6.2 建立 `src/App.tsx`:單一畫面,依 `useAuth()` 切換 —— `isLoading` 顯示 `FullscreenLoader`、未登入顯示登入入口、已登入顯示產品清單。保留現行首頁的漸層背景、圓形 logo 與標題文案(D9)
- [ ] 6.3 產品連結用同分頁普通連結(不加 `target="_blank"`、不用 iframe、不附加任何參數)。驗證:點擊後網址列與設定中的 URL 完全相同
- [ ] 6.4 未設定 `VITE_PORTAL_PRODUCTS` 時顯示空清單說明文字。驗證:清空該變數重啟,首頁不報錯也不白畫面
- [x] 6.5 刪除 `lib/redirect.ts`。驗證:`grep -rn "#token=\|sso_redirect_uri\|ALLOWED_REDIRECT_HOSTS\|isAllowedRedirectUri" . | grep -v node_modules | grep -v openspec/` 零命中

## 7. 容器化

- [x] 7.1 從 `DEMO/Dockerfile` 取得兩階段建置(node build → nginx serve),改成以 `ARG` → `ENV` 提供五個設定值(而非 demo 的「沒有任何 VITE_* 的 ARG/ENV」),並保留說明為什麼不走 `.env` 的註解
- [x] 7.2 從 `DEMO/nginx.conf` 取得設定,**保留 `try_files` 那段註解**(D2 依賴它);不需要 demo 的 entrypoint 相關設定
- [x] 7.3 在 `npm run build` 之前加一道檢查:`VITE_AUTHENTIK_AUTHORITY` / `VITE_AUTHENTIK_CLIENT_ID` / `VITE_AUTHENTIK_REDIRECT_URI` 任一為空就讓建置失敗並指名該項。驗證:不給 `--build-arg` 跑 `docker build`,建置終止且訊息指名缺少的變數
- [x] 7.4 驗證建置參數確實生效且本機設定沒有混入:用正式環境的 `--build-arg` 建置,image 裡 grep 得到正式的 authority、grep 不到本機的 `localhost:9000`
- [x] 7.5 驗證產物不含完整 env 物件:`grep -o 'VITE_[A-Z_]*' dist/assets/*.js` 除了 UI 文案之外沒有其他命中(動態鍵值存取會讓整包進去,見 D16)

## 8. 文件與驗收

- [x] 8.1 重寫 `CLAUDE.md`:登入流程改述為 launcher 模式,移除 token 轉交與 `NEXT_PUBLIC_*` 的說明,補上「設定在建置時燒進產物」與「具名存取」這兩條規則
- [x] 8.2 刪除 `AGENTS.md` 的 Next.js 警告區塊(它是 `next dev` 生成的,隨 Next.js 一起退場);若 `AGENTS.md` 因此沒有內容就整支刪除
- [x] 8.3 重寫 `README.md`(現在是 `create-next-app` 原封不動的樣板,而且寫 6174):改成本專案的啟動方式、五個設定項、`docker build --build-arg` 的部署方式、Authentik 前置設定的指引
- [x] 8.4 `npm run lint` 與 `npx tsc -b` 皆通過
- [ ] 8.5 端到端一:在 Portal 登入一次 → 點產品連結 → **不再問密碼**
- [ ] 8.6 端到端二:從 Portal 登出 → 三個產品都要重新登入(完整 SLO)
- [ ] 8.7 端到端三:從某個產品登出 → **只有它**被登出,Portal 仍為已登入
- [ ] 8.8 確認 token 續期:登入後放置到 access token 過期時間之後,頁面仍為已登入且登出按鈕還在(若失敗,回頭檢查 1.3 的 `offline_access`,見 design.md Risks)
