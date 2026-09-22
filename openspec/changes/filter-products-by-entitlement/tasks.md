# Tasks

> Authentik 端的完整操作步驟見 `docs/authentik-product-entitlements.md`,此處只列要做哪幾件與怎麼驗。

## 1. 前置:Authentik 的 `products` scope mapping(本 repo 之外)

- [ ] 1.1 **Customization → Property Mappings → Create → Scope Mapping**:**Scope name** 填 `products`(不是 Name 那一欄),Expression 用 `sorted({g.name.split(":")[0] for g in request.user.ak_groups.all()})` 包成 `{"products": ...}`
- [ ] 1.2 **應用程式 → 供應商 → `bon-portal-app` → 編輯 → Scopes**:把該 mapping 加到 Selected
- [ ] 1.3 確認產品層級群組存在(`bonsale` / `bontalk` / `bonai`),並把測試帳號加進其中一兩個(要能驗「只看到一部分」)
- [ ] 1.4 驗收:`curl -s <authority>/.well-known/openid-configuration | jq '.scopes_supported'` 看得到 `products`(沒看到就是 1.1 或 1.2 沒做對,Authentik 不會報錯)

## 2. 產品目錄搬進程式碼

- [x] 2.1 新增 `src/products.ts`:`Product = { key, name, url }` 與 `PRODUCTS` 陣列,`key` 對應 Authentik 的產品群組名,`name` 明寫顯示名稱(D4)。以 `import.meta.env.DEV` 切換本機/正式網址(D3),本機指向 demo 的 `localhost:6175-6177`。驗證:`npx tsc -b` 無錯誤
- [x] 2.2 `src/App.tsx` 改為讀 `PRODUCTS`(此時**還不過濾**,行為與現在相同)。驗證:`npm run dev` 首頁顯示全部產品,名稱是明寫的那個而不是 host
- [x] 2.3 刪除 `src/utils/portalProducts.ts`(D7)。驗證:`grep -rn "portalProducts\|getPortalProducts" src/` 零命中
- [x] 2.4 移除 `VITE_PORTAL_PRODUCTS`:`src/vite-env.d.ts`、`.env`、`.env.example`、`Dockerfile` 的 ARG/ENV 與必要參數檢查清單。驗證:`grep -rn "VITE_PORTAL_PRODUCTS" . | grep -v node_modules | grep -v openspec/ | grep -v docs/` 零命中

## 3. 依授權過濾

- [x] 3.1 `src/config/oidc.ts` 的 scope 加上 `products`。驗證:登出再登入後,devtools 看得到 `auth.user.profile.products`(**一定要重新登入**,舊 token 不會長出新 claim)
- [x] 3.2 在 `src/products.ts` 或 `src/App.tsx` 加入過濾:取 `PRODUCTS` 與授權清單的交集,對不上的授權項目忽略。驗證:測試帳號只在 `bonsale` 群組時,首頁只顯示 BonSale
- [ ] 3.3 驗證非產品群組不造成問題:把測試帳號加進一個不對應任何產品的群組(例如 `staff`),首頁顯示不變、不報錯
- [ ] 3.4 驗證細項權限也算數:把測試帳號從 `bonsale` 移到只有 `bonsale:admin`,首頁**仍然**顯示 BonSale(這是 D1 讓 Authentik 先歸納的主要理由)

## 4. 三態處理

- [x] 4.1 `src/App.tsx` 區分三種狀態(D5):claim 不存在 / `[]` / 有值。三者的畫面文案必須不同
- [x] 4.2 claim 不存在時顯示「無法取得您的服務授權,請與我們聯繫」,**不得**顯示成「您沒有可使用的服務」,也不得把設定名稱或錯誤代碼當成主要訊息。驗證:暫時把 scope 裡的 `products` 拿掉重新登入,確認看到的是這一種
- [x] 4.3 `[]` 時顯示「目前沒有可使用的服務」並指向聯繫管道。驗證:把測試帳號從所有產品群組移除,重新登入
- [ ] 4.4 把 4.2 的 scope 改回來,確認恢復正常

## 5. 文件

- [x] 5.1 `docs/authentik-product-entitlements.md` 開頭的狀態改成已實作,移除「程式端尚未實作」那段
- [x] 5.2 `CLAUDE.md`:設定段落的變數數量更新;新增一段說明「產品目錄在程式碼、授權在 Authentik」這條分界與理由
- [x] 5.3 `README.md`:設定項清單更新;部署範例移除 `VITE_PORTAL_PRODUCTS` 的 `--build-arg`
- [x] 5.4 確認 Cloud Run 部署不再需要 `^@^` 自訂分隔符(那是為了產品清單裡的逗號才有的)

## 6.(可選、可獨立放棄)回呼網址改由 origin 推導 —— D8

> 這一組與依授權過濾無關。不做的話前五組完全不受影響。

- [ ] 6.1 在 Authentik 的 Redirect URIs 同時註冊本機與正式環境兩筆(type 各自對應 login / logout)
- [ ] 6.2 `src/config/oidc.ts` 的 `redirect_uri` 與 `postLogoutRedirectUri` 改為 `${window.location.origin}/`
- [ ] 6.3 移除 `VITE_AUTHENTIK_REDIRECT_URI` 與 `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI`:`src/vite-env.d.ts`、`.env`、`.env.example`、`Dockerfile`。設定項應剩 2 個
- [ ] 6.4 驗證:`npm run dev`(6030)登入登出各一次都正常;`npm run build && npm run preview`(不同 port)登入會被 Authentik 以 `invalid_request` 擋下,證明推導確實跟著執行位址走

## 7. 驗收

- [x] 7.1 `npx tsc -b` 與 `npm run lint` 皆通過
- [x] 7.2 建置產物不含產品以外的設定殘留:`grep -o 'VITE_[A-Z_]*' dist/assets/*.js` 沒有 `VITE_PORTAL_PRODUCTS`
- [ ] 7.3 端到端:用只授權一個產品的帳號登入 → 首頁只有那一個 → 點進去不問密碼
- [ ] 7.4 端到端:用授權兩個產品的帳號登入 → 首頁兩個都在
- [ ] 7.5 確認前一個 change(`rebuild-portal-as-vite-launcher`)的 19 項驗收不因本 change 而失效 —— 特別是登出繞道與 token 續期
