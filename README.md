# Bon Portal

提供給簽約客戶的服務登入入口(launcher)。前端 only,身分由自架的 [Authentik](https://goauthentik.io/) 提供。

客戶在這裡登入一次,建立起 Authentik 的 SSO session,之後點首頁的服務連結就能直接進去 —— 各服務自己跑一次 OIDC,靠瀏覽器已有的 session cookie 靜默完成登入。**Portal 不經手任何服務的憑證。**

帳號不開放自助註冊:簽約後由我們在 Authentik 預先建立帳號並設定該客戶可用的服務。

## 開發

```bash
cp .env.example .env    # 填入你的 Authentik 設定
npm install
npm run dev             # http://localhost:6030
```

| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發伺服器,固定 port 6030 |
| `npm run build` | 型別檢查 + 打包到 `dist/` |
| `npm run preview` | 預覽 build 產物 |
| `npm run lint` | oxlint |

## 設定

四個環境變數,說明見 `.env.example`。**沒有一個是機密** —— Portal 是 public client(靠 PKCE,沒有 client secret),client_id 本來就會出現在授權請求的網址上。

| 變數 | 說明 |
|---|---|
| `VITE_AUTHENTIK_AUTHORITY` | Authentik 這個 application 的 issuer,結尾要有斜線 |
| `VITE_AUTHENTIK_CLIENT_ID` | 對應 provider 的 client id |
| `VITE_AUTHENTIK_REDIRECT_URI` | 登入後導回的位址,就是首頁 |
| `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` | 登出後導回的位址,同上 |

**首頁要列哪些服務不在這裡。** 產品目錄對所有部署都一樣,屬於程式碼(`src/products.ts`);
而「哪個客戶能看到哪些服務」由 Authentik 的授權決定(見 `docs/authentik-product-entitlements.md`)。
因此部署時不需要跟 `gcloud` 的逗號分隔語法(`^@^`)打架。

設定在 **build 時**燒進產物,一個 image 對應一個環境。本機開發讀 `.env`;build image 時由 `--build-arg` 提供(見下方「部署」)。少了必要參數 build 會直接失敗。

## Authentik 端的前置設定

在 Authentik 後台為這個 Portal 建立 Application + Provider(**Client type 選 Public**),然後:

1. **Redirect URI** 填 `VITE_AUTHENTIK_REDIRECT_URI` 的值,**逐字相同**(連結尾斜線都算)
2. **再加一筆 type=logout、matching mode=strict** 的 redirect URI,值是 `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI`
3. **Scopes 勾上 `offline_access`** —— 少了它拿不到 refresh token,登入約五分鐘後登出按鈕會消失
4. **建立 `products` 的 Scope Mapping 並加進 Scopes** —— 首頁要靠它決定顯示哪些服務,步驟見 `docs/authentik-product-entitlements.md`
5. **Invalidation flow 綁 `default-invalidation-flow`**(含 `UserLogoutStage`,才是完整 SLO)。各服務則應該綁 `default-provider-invalidation-flow`,這樣「從 Portal 登出」會登出全部、「從某個服務登出」只影響它自己。**不要去改那條共用的 default flow 本身**

驗收:

```bash
curl -s <authority>/.well-known/openid-configuration \
  | jq '{issuer, scopes_supported, end_session_endpoint}'
```

`issuer` 要**逐字**等於你設的 `VITE_AUTHENTIK_AUTHORITY`。Authentik 的 issuer 是從請求的 Host 標頭算出來的,換 host 就是換 issuer —— 而換 issuer 會讓已綁定的使用者變成一個系統沒見過的新帳號,**症狀不是報錯,是這個人的資料不見了**。這個值一經上線就不要再動。

## 部署

設定是 build 時燒進去的,所以要在 `docker build` 給,不是 `docker run`:

```bash
docker build \
  --build-arg VITE_AUTHENTIK_AUTHORITY=https://authentik-sso.example.com/application/o/bon-portal-app/ \
  --build-arg VITE_AUTHENTIK_CLIENT_ID=... \
  --build-arg VITE_AUTHENTIK_REDIRECT_URI=https://portal.example.com/ \
  --build-arg VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=https://portal.example.com/ \
  -t bon-portal .

docker run -p 6030:80 bon-portal
```

產物是靜態檔,由 nginx 提供。**改任何設定(包括新增一個服務到清單裡)都要重新 build 一版** —— 成本很低:build 不到一秒,push 的只有變動的那層,而且在 Cloud Run 上改環境變數本來也要部署一個新 revision。

`.env` 被 `.dockerignore` 擋在 build context 外,所以本機的開發設定不會誤燒進正式版的 image。

## 更多

架構背景、為什麼這樣設計、以及各項決定的理由,見 `CLAUDE.md` 與 `openspec/`。
