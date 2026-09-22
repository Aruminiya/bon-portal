# Design

## Context

動機見 `proposal.md` 的 Why。影響做法的現況:

- 現有 bon-portal 的 8 個頁面/元件全部是 `"use client"`,唯一的 server component `app/layout.tsx` 沒有做任何伺服器端的事。真正要留下來的只有 `lib/theme.ts`(Bonvies 色票)與 NavBar / 首頁的視覺。
- demo(`~/Desktop/Program/Demo/authentik/code/authentik-react-demo-app`,1083 行)是一個做完的 Vite + React launcher,且已經跑過 portal + 三個產品的完整 SSO 情境(見其 `docker-compose.yml`)。它的登出繞道、runtime env 注入、產品清單解析都是實際踩過 Authentik 的坑之後的產物。
- 因此本 change 的主要動作是 **刪除與搬移**,不是撰寫新邏輯。工作量的重心在「拆掉 demo 的示範內容」與「換上 bon-portal 的外觀」。
- `openspec/specs/` 目前是空的,本 change 的三份 delta 是專案的第一份 spec。

## Goals / Non-Goals

**Goals:**

- 讓 Portal 只持有自己的 session,任何憑證都不離開本機。
- 移除 SSR 這一層 —— 它在這個 app 裡沒有用途,卻是兩處 hydration 變通的來源。
- 設定與程式碼解耦到「換一個環境只要換一組建置參數」,且本機的開發設定不可能洩漏進正式產物。
- 最大化重用 demo 已驗證的部分,把新寫的程式碼降到最低。

**Non-Goals:**

- 不為舊的 `?redirect_uri=` / `#token=` 入口做相容轉接。下游三隊尚未動工。
- 不做「切換帳號」功能(理由見 Risks)。
- 不做 BFF(判斷依據與未來的重啟條件見「何時該回來重新考慮 BFF」)。
- 不處理測試與 CI —— 另開 change。

## Decisions

### D1 — 在現有 repo 原地替換,保留 git 歷史

不開新 repo。做法是在 `bon-portal` 這個 repo 裡刪掉 `app/`、`next.config.ts` 等,加進 `index.html` + `src/`,改寫 `package.json`。git 歷史、issue、部署設定的指向都不用動。

**一次換乾淨,不要漸進。** Next.js 與 Vite 的設定檔、型別、entry point 並存會讓 build 兩邊都不過,中間狀態沒有可驗證的意義。

### D2 — 不安裝 react-router,Portal 只有一個畫面

改成 launcher 之後 Portal 只剩一個畫面:未登入顯示登入入口、已登入顯示產品清單。demo 的 `/login` `/dashboard` 兩頁在這裡沒有存在理由(它那樣分是為了示範 `ProtectedRoute`)。

未知路徑的處理不需要 router —— nginx 的 `try_files` 已經讓任何路徑回傳 `index.html`,應用程式啟動時若 `location.pathname !== "/"` 就 `history.replaceState({}, "", "/")` 把網址正規化。兩行。

*替代方案*:裝 `react-router-dom` 配一條 `*` route。否決 —— 為了兩行邏輯多一個相依。之後真的長出第二個畫面時再裝,成本一樣。

### D3 — `redirect_uri` 指向首頁 `/`,不另設回呼路由

`AuthProvider` 掛在應用程式根部,`oidc-client-ts` 偵測到網址帶 `code`/`state` 時會自動完成交換,不需要專屬的回呼頁面。demo 就是這樣做的(它的 `redirect_uri` 指向 `/login`)。

因此 `app/auth/authentik/callback/` 整個消失。`onSigninCallback` 仍要保留,負責把 `code`/`state` 從網址列抹掉(授權碼單次有效),而 StrictMode 下重複掛載的防護由 `oidc-client-ts` 自己處理。

**Authentik 那邊要註冊的 redirect URI 因此是 `http://localhost:6030/`** —— 含尾斜線,與 D7 一致。

### D4 — 環境變數沿用 `VITE_` 前綴,這不是風格選擇

Vite 在建置時**只會替換 `VITE_` 開頭的變數**(不論來源是 `.env` 還是 `process.env`)。把前綴拿掉,`import.meta.env.AUTHENTIK_AUTHORITY` 會被替換成 `undefined`,而且不會有任何警告。

這與上一版規劃(Next.js,拿掉 `NEXT_PUBLIC_`)相反,原因是兩個建置工具對前綴的處理不同,不是改變主意。

採用的變數(對齊 demo 的命名):`VITE_AUTHENTIK_AUTHORITY`、`VITE_AUTHENTIK_CLIENT_ID`、`VITE_AUTHENTIK_REDIRECT_URI`、`VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI`、`VITE_PORTAL_PRODUCTS`。

demo 專用的 `VITE_DEMO_APP_NAME` / `VITE_DEMO_APP_TYPE` / `VITE_THEME_COLOR` / `VITE_AUTHENTIK_ENROLLMENT_URL` / `VITE_AUTHENTIK_SCOPE` 不移植(scope 在 `oidc.ts` 寫死成 `openid profile email offline_access`,Portal 沒有讓它可設定的理由)。

### D5 — 登出直接用 `auth.signoutRedirect()`,不做繞道

end-session 的位址由 discovery 取得(少一個要維護、且可能與 `authority` 不一致的設定值),整個登出交給 `signoutRedirect()`。

它內部依序是:取 user 的 `id_token` 當 `id_token_hint` → `removeUser()` → 導向 end-session。**順序正是需要的** —— 特別是 `removeUser()` 在導向之前:登出帶 `post_logout_redirect_uri` 會回到 Portal,本機 user 還留著的話使用者會看到「已登入」,但 Authentik 的 session 其實已經結束,那是會誤導人的假狀態。

連帶:「沒設定端點就不顯示登出按鈕」這個舊機制消失。端點缺漏改為呈現錯誤 —— discovery 沒有 end-session 端點是身分提供者端的設定缺漏,不是「功能還沒接上」。

**原本這裡是一個繞道**:Authentik **2026.8.0** 有個 bug —— session 殘留未完成的 flow plan 時,`EndSessionView.dispatch()` 回一個 body 全空的 HTTP 200 且根本沒登出,症狀是「第一次正常、第二次以後白畫面」。當時的解法是先導去 `/flows/-/cancel/` 清掉殘留。

**在 2026.8.1 上實測連續登出兩輪都不再重現,所以繞道移除。** 判斷依據是版本差異(demo 的 compose 釘在 `2026.8.0`,本次驗證環境是 `2026.8.1`),不是「不知為何好了」。成因與繞道寫法留在 `CLAUDE.md` 的登出段落當診斷線索:**若登出又出現空白的 200,先查 Authentik 版本。**

> (原 D6「登出順序」已併入 D5 —— 順序現在由 `signoutRedirect()` 內部保證,不再是我們要自己維持的東西。)

### D7 — `post_logout_redirect_uri` 定為帶尾斜線的 `origin + "/"`

Authentik 對這個值是**逐字比對**,連尾斜線都算不同。demo 用的是 `window.location.origin + '/'`(帶斜線),現有 bon-portal 的註解用的是不帶斜線的 origin。**統一採用帶斜線版**,與 D3 的 `redirect_uri` 一致,Authentik 那邊兩筆都註冊成 `http://localhost:6030/`。

### D8 — user 存 sessionStorage(`oidc-client-ts` 預設),不改成 localStorage

分頁關掉就清,憑證不長期留在磁碟。代價是「開新分頁要重跑一次授權」,但那一次是靜默的(Authentik SSO cookie 還在),使用者不會被問密碼。

### D9 — 保留 bon-portal 的外觀,不用 demo 的

`lib/theme.ts` 的 Bonvies 色票原樣搬到 `src/theme.ts`。NavBar 的圓形 B logo、首頁的漸層背景與標題文案都保留。demo 的 `theme.ts`(含 `VITE_THEME_COLOR` 的多色切換)不移植 —— 那是為了讓四個示範容器長得不一樣。

### D10 — lint 換成 oxlint,對齊 demo

`eslint-config-next` 隨 Next.js 一起退場,現有的 `eslint.config.mjs` 失去大部分內容。改用 demo 已在用的 `oxlint`(零設定、快)。

*替代方案*:留 eslint 配 `eslint-plugin-react-hooks`。可行,但要自己配一份設定;等測試那個 change 要加守門規則時再評估是否換回來。

### D11 — 相依版本整套照 demo 的已驗證組合

Vite 8 / `@vitejs/plugin-react` 6 / TypeScript 7 / MUI 9 / React 19.2.8 / `react-oidc-context` 3.3 / `oidc-client-ts` 3.5。

TypeScript 7 相對新,但 demo 已經用它 build 過。整套照抄的價值在於「出問題時可以直接跟 demo 對照」,拆開挑版本會失去這個。

### D12 — port 維持 6030

Vite dev server 設 `port: 6030, strictPort: true`(照 demo 的寫法,strictPort 讓 port 被占用時直接失敗而不是靜默換一個)。容器內 nginx 聽 80,對外映射 `6030:80`。

### D13 — demo 的示範內容明確刪除

`TokenPanel.tsx`(101 行,顯示 token 內容)、`TokenExpiry.tsx`、`utils/jwt.ts`、`ProtectedRoute.tsx`(單頁不需要)、`NotFoundPage.tsx`(見 D2)、`DashboardPage.tsx` 的示範卡片與「群組與權限」區塊。

`FullscreenState.tsx` 保留 —— 登入狀態確認中的全螢幕載入畫面在 Portal 一樣需要。

### D14 — 何時該回來重新考慮 BFF

本次判斷:Portal 的 token 在 launcher 模式下只用於「顯示登入者」與「登出的 `id_token_hint`」,把登入搬到伺服器所保護的資產價值極低,而代價(server session 儲存、cookie 加密、CSRF、`client_secret` 輪替)是持續的。

**三個觸發條件,任一成立才重新評估:**

1. Portal 要開始代表使用者去呼叫其他服務的 API(那時 access token 才有價值)
2. 產品清單要依人而不同,且群組結構不能放進 `id_token`(放得進去的話前端就能過濾,不需要伺服器)
3. 合規要求 token 不得落在瀏覽器

注意第 2 條的但書:「需要一個伺服器端點」不等於「需要 BFF」。要在伺服器讀 Authentik 資料,加一條 route + 一個 API token 即可,登入流程不用動 —— 那是兩件事。

改成 Vite 之後若真要走 BFF,需要另外引入一個後端(或退回 Next.js)。以三年為尺度估算,要丟掉的是 `config/oidc.ts` + `main.tsx` 的 AuthProvider 接線,約 50 行。

### D15 — 測試不在本 change,但 runner 已定為 Vitest

目標範圍(已確認):`utils/portalProducts.ts` 的解析(含壞掉的 URL)、`config/runtimeEnv.ts` 的 fallback、登出 URL 的組成 —— 三者都是純函式。Vitest 與 Vite 同生態,設定成本比上一版規劃(Next.js)更低。

同時要有一條守門機制,禁止以動態鍵值存取 `import.meta.env`(理由見 D16),並確保所有設定項都在 `src/vite-env.d.ts` 宣告。

### D16 — 設定在建置時燒進產物,不做執行時注入

demo 用 entrypoint 腳本在容器啟動當下產生 `/env-config.js` → `window.__ENV__`,讓**一份 image 跑四個容器**(portal + 三個假產品)。Portal 只有一個部署,沒有那個需求。

量過的成本:`npm run build` **0.85 秒**,`dist/` 464 KB,重建只有那一層會變,push 是幾百 KB。而**在 Cloud Run 上改環境變數本來就會產生一個新 revision,也是一次部署** —— 執行時注入並沒有省掉部署那一步,只省掉建置與推送的那十幾秒。

連帶刪掉的:`src/config/runtimeEnv.ts`、`public/env-config.js`、`docker-entrypoint.d/`、`index.html` 裡那個必須排在 `main.tsx` 之前的 script 標籤。少了一整條「本機正常、進容器靜默失效」的失效途徑。

**設定的來源用 `ARG` 而非讓 `.env` 進 build context。** `.env` 是本機的開發設定(`localhost:9000`);讓它進 image 的話,忘記改就會把 dev 的 Authentik 位址燒進正式版,而那種錯誤沒有任何錯誤訊息,只會讓使用者登入到錯的地方。`.dockerignore` 擋著它,`Dockerfile` 在 `npm run build` 之前檢查三個必要參數,缺了就讓建置失敗。

*替代方案一*:保留執行時注入只給 `VITE_PORTAL_PRODUCTS`(最會變的那一個)。否決 —— 為了省十幾秒的建置,留下兩套設定機制與那條靜默失效的途徑,不划算。

*替代方案二*:用 `.env.production`。否決 —— 檔案在 repo 裡就會有人改錯、或忘記它存在;`ARG` 強迫每次明寫。

**必須具名存取 `import.meta.env.VITE_XXX`,不可用動態鍵值。** 這不是風格:`import.meta.env[key]` 會讓 Vite 把**整個 env 物件**寫進產物(demo 的 `getEnv` 就是這樣,它的產物裡有完整的 env 物件);具名存取只替換那一個值。已驗證。


## Risks / Trade-offs

**[原地替換的中間狀態不可用]** → Next.js 與 Vite 的設定並存時兩邊的 build 都會壞。對策:當成一次性的切換來做,切換期間不試圖讓 `npm run dev` 保持可用;切換完成後一次驗證。

**[issuer 換 host = 換掉所有人的身分]** → Authentik 的 issuer 從請求的 `Host` 標頭算出。改 authority 會讓已綁定的 `(issuer, subject)` 安靜地變成孤兒 —— **症狀不是壞掉,是這個人變成一個沒見過的新使用者**。以 `curl <authority>/.well-known/openid-configuration | jq '{issuer, scopes_supported}'` 驗證 `issuer` 逐字等於設定的 authority,且此值一經確定不再改動。

**[`offline_access` 被靜默交集掉]** → Authentik 會把未設定的 scope 從請求裡默默移除而不報錯,結果是拿不到 refresh token,silent renew 退回隱藏 iframe + `prompt=none`;而 `authentik_session` 是第三方 cookie,本機 same-site 能跑、**上雲一定被瀏覽器擋**。所以「本機正常」不能當作通過,要以 `scopes_supported` 驗。

**[沒有 refresh 時登出按鈕會消失]** → `react-oidc-context` 的 `isAuthenticated` 定義是 `user && !user.expired`,access token 一過期就變 false,登出按鈕跟著不見,使用者做不了 SLO。這正是現有 bon-portal 在 `lib/authentik.ts:122-125` 刻意不檢查 `exp` 所繞開的同一個坑。因此 `offline_access` 對 Portal 不是裝飾。

**[逐字比對的兩個 URI]** → `redirect_uri` 與 `post_logout_redirect_uri` 都是 Authentik 端 strict 比對。D3/D7 已把兩者統一成帶尾斜線的 `http://localhost:6030/`,**但 Authentik 後台目前註冊的是 `http://localhost:6174/auth/authentik/callback`** —— 兩處都不一樣,是會讓第一次測試就失敗的已知不一致。

**[改到共用的 invalidation flow]** → 每個 provider 只能綁一個。Portal 綁 `default-invalidation-flow`(含 `UserLogoutStage`,完整 SLO),各產品綁 `default-provider-invalidation-flow`(0 stage,只登出該 app)。**不要改那條共用的 default flow**,否則所有 app 的登出都會變成 SLO。

**[Authentik 升版可能讓登出 bug 回來]** → 2026.8.0 的空白頁 bug 在 2026.8.1 實測已消失,繞道因此移除。若升版或換環境後登出又出現空白的 200,那是同一個 bug —— 成因與繞道寫法留在 `CLAUDE.md` 的登出段落與 git 歷史。

**[想做「切換帳號」]** → 不要做。`prompt=login` 在 Authentik 不可靠(upstream #12182 / #18507),`select_account` 不在 Authentik 的 `ALLOWED_PROMPT_PARAMS` 裡。demo 做過又移除。

**[TypeScript 7 與 Vite 8 都很新]** → 對策是整套照 demo 的組合,不自行挑版本;出問題時可以直接與 demo 對照,而不是在兩個不同的版本矩陣之間猜。

**[破壞性改動沒有相容層]** → 任何仍在使用 `?redirect_uri=` 的呼叫端會直接壞掉。已確認下游三隊尚未動工,接受這個代價。

## Migration Plan

順序不能顛倒:

1. **先改 Authentik**(本 repo 之外):redirect URI 與 logout redirect URI 都改成 `http://localhost:6030/`、issuer 改用正式 host、加 `offline_access` scope mapping、綁 `default-invalidation-flow`。以 discovery 文件驗收。
2. **再改程式**:依 tasks 的順序 —— 先建立 Vite 骨架與 runtime env(其他每件事都依賴它),再接 OIDC,再搬外觀,最後做產品清單與容器化。
3. **實測三件事**(缺一不可):
   - 登入一次 → 點產品連結 → 不再問密碼
   - 從 Portal 登出 → 三個產品都要重新登入(完整 SLO)
   - 從某個產品登出 → 只有它被登出,Portal 還在

**Rollback**:因為是原地替換,程式端 `git revert` 就回到 Next.js 版本。Authentik 端的改動(多註冊 redirect URI、多勾一個 scope)對舊版程式是**相容的**,不需要一起回滾 —— 唯一不相容的是 issuer 換 host,所以那一項最後才動。

## Open Questions

- 正式環境的 Portal 對外網域尚未定案。不影響設計與任務拆解(它就是兩個設定值),但部署前必須與 Authentik 的註冊值同時決定。
- 產品清單目前以 host 當顯示名稱。若之後要顯示中文名,設定格式要從「逗號分隔 URL」擴充成帶名稱的形式 —— 可延後,擴充時 `product-launcher` spec 的第二條需求要跟著改。
