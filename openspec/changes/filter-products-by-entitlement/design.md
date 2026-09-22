# Design

## Context

動機見 `proposal.md` 的 Why。影響做法的現況:

- Authentik 的群組是**產品層級**(`bonsale` / `bontalk` / `bonai`),底下再用 `<產品>:<細節>` 命名細項權限(例如 `bonsale:admin`)。這份權限在業務簽約後由我們在後台設定。
- Portal 目前的 `src/utils/portalProducts.ts` 解析 `VITE_PORTAL_PRODUCTS` 這個逗號分隔字串,顯示名稱取自 URL 的 host,並逐筆 `try/catch` 防止一筆壞掉害死整份。
- `src/config/oidc.ts` 的 scope 是寫死的 `openid profile email offline_access`。
- 設定已經是**建置時燒進產物**(見 `rebuild-portal-as-vite-launcher` 的 D16),不是執行時注入。
- Authentik 端的設定步驟已經寫成 `docs/authentik-product-entitlements.md`,本 change 不重複那份內容,只在 tasks 引用。

## Goals / Non-Goals

**Goals:**

- 讓每個客戶只看到自己合約內的服務。
- 把「產品有哪些」從部署設定搬回程式碼,取回型別、註解與版本控制。
- 授權資料的唯一來源是 Authentik,Portal 不維護任何「誰買了什麼」的副本。

**Non-Goals:**

- 不把 Portal 變成存取控制的關卡(見 D6)。
- 不處理錯誤訊息客戶化、i18n、測試與 CI。
- 不動登入 / 登出流程本身。

## Decisions

### D1 — Authentik 回「已歸納到產品層級」的 claim,不是原始 groups

新增一個 scope mapping,吐出的是去重、排序後的產品層級清單:

```python
return {
    "products": sorted({g.name.split(":")[0] for g in request.user.ak_groups.all()}),
}
```

*替代方案*:直接用既有的 `groups` claim,前端自己做 prefix 比對。否決,三個理由:

1. **比對容易寫錯。** 只有 `bonsale:admin` 而沒有裸 `bonsale` 的客戶,用 `includes('bonsale')` 會比對不到 —— 明明有買卻看不到連結。正確寫法要「等於產品名,或以產品名加冒號開頭」,而且不能只用 `startsWith`(產品 `bon` 會誤中 `bonsale`)。這層邏輯放在 Authentik 做掉,前端就只剩單純的交集。
2. **token 會變大,而且會撞到登出。** 三個產品各十幾條細項權限就是幾十筆。登出時 `id_token` 要當 `id_token_hint` 放進網址查詢字串,而登出繞道又把整串 end-session URL 再塞進 `next` 參數 —— token 越大這條 URL 越長,長到一定程度會撞上 Authentik 前面那層 proxy 的 header buffer 上限(通常 4–8KB)。權限只有幾條不會有事,上百條就會,而且症狀很難查。
3. **Portal 不需要知道細項權限。** 它只決定顯示不顯示連結,細項是各產品自己的事。

每個 provider 的 Scopes 是分開設定的,所以 BonSale 那個 provider 照常吐完整 `groups`,Portal 這個只吐 `products`,互不影響。

**非產品的群組不用在 Authentik 端過濾** —— 內部群組(`staff` 之類)也會被歸納進 `products`,但前端是拿它跟產品目錄**取交集**,對不上的自然被忽略。少一處要同步維護的名單。

### D2 — 產品目錄用 `.ts`,不是 `.json`

| | `.json` | `.ts` |
|---|---|---|
| 註解 | ❌ JSON 不支援 | ✅ |
| 型別 | 只有推導出的形狀 | ✅ 明確的 `Product[]` |
| 依執行模式切換值 | ❌ | ✅(見 D3) |

註解那條對這個 repo 特別重要:整份程式碼的慣例是用中文註解寫「為什麼」,而產品目錄正是最需要註解的地方(這個 key 為什麼是這個名字、這個產品為什麼暫時停用)。

「JSON 比較好給非工程師改」在這裡不成立 —— 改完要建置 + 部署,本來就是工程師的動作。

### D3 — 本機與正式環境的網址用 `import.meta.env.DEV` 切換

本機驗證需要指向 demo 的三個假產品(`localhost:6175-6177`),正式環境是真網域。Vite 內建 `import.meta.env.DEV`,不需要任何額外設定,也不需要把網址變回設定項。

### D4 — 顯示名稱明寫,不從 host 推導

原本取 `new URL(entry).host`,客戶會看到 `bonsale.bonvies.com`。改成目錄裡明寫「BonSale」—— 這是給客戶看的介面,不是給維運看的。

### D5 — 授權資訊的三態必須分開呈現

| 狀態 | 意思 | 畫面 |
|---|---|---|
| claim 不存在 | **我們的設定錯了** | 「無法取得您的服務授權,請與我們聯繫」 |
| `[]` | 這個客戶確實沒有產品(例如合約到期) | 「目前沒有可使用的服務」 |
| 有值 | 正常 | 對應的產品 |

**設定錯誤不能看起來像「你沒有買任何東西」** —— 對付費客戶來說那是完全不同的兩件事,而且第一種的正確反應是聯繫我們,第二種不是。

這個三態分法沿用參考實作的既有判斷(demo 的「群組與權限」卡片刻意分 `null` / `[]` / 有值三種)。

### D6 — 過濾不是安全邊界,而且刻意不做成安全邊界

客戶打開開發者工具竄改 claim 就能讓所有連結顯示出來。**這不要緊,而且不該去防**:真正的關卡在各產品那邊 —— 產品自己跑 OIDC,Authentik 依該 application 的 policy binding 決定放不放行。

把這條寫進 spec 是為了防止之後有人看到「前端可竄改」就去加一層 Portal 端的驗證 —— 那會讓 Portal 變回它刻意不當的角色(存取控制的中繼站),而且擋不住任何真實攻擊,因為攻擊者本來就可以直接開產品的網址。

### D7 — 刪除防禦性解析

`src/utils/portalProducts.ts` 整支刪除。split / trim / 逐筆 `try/catch` 存在的前提是「值是人手打在一個字串裡」,改成型別化陣列之後前提消失。打錯網址變成 code review 與 git 歷史管得到的事。

### D8 —(可選、可拆)回呼網址改由 `origin` 推導

`VITE_AUTHENTIK_REDIRECT_URI` 與 `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` 永遠等於 `${window.location.origin}/`,改成推導後設定項剩 2 個。

**這推翻了 `rebuild-portal-as-vite-launcher` 的 D11**,該決定當時反對推導,理由是「會在本機與正式環境之間無聲漂移」。那個理由站不住:**Authentik 的 Redirect URIs 本來就可以註冊多筆**,本機與正式各登記一筆,推導出來的值在兩邊都正確。反而硬寫在設定裡才容易錯 —— 換網域忘記改,登入就壞,而且錯誤是 Authentik 回的 `invalid_request`,不會指出原因。

這一項與本 change 的主軸(依授權過濾)無關,**tasks 獨立成一組,不做也不影響其他部分**。

### D9 — 歸檔順序:本 change 必須排在 `rebuild-portal-as-vite-launcher` 之後

`openspec/specs/` 目前是空的,`product-launcher` 與 `deployment-config` 只存在於前一個 change 的 delta 裡。`openspec validate` 已經明白提示:

```
Archive would refuse this delta: deployment-config: target spec does not exist;
only ADDED requirements are allowed for new specs.
```

不影響規劃與實作,只影響歸檔順序。

## Risks / Trade-offs

**[Authentik 的 scope mapping 有兩種靜默失效]** → (1) **Name** 與 **Scope name** 是兩個欄位,填錯的症狀是「請求了但 claim 就是不出現」,不報錯;(2) mapping 沒加進 provider 的 Selected,Authentik 會靜默把 `products` 從請求裡交集掉 —— 跟 `offline_access` 同一個坑。兩者的共同症狀都落在 D5 的「claim 不存在」那一格,所以那一格的訊息要能讓我們一眼認出是設定問題。

**[改完 scope 要重新登入]** → 舊的 token 不會長出新 claim。拿舊 session 測會誤判成「功能沒生效」而去改程式。

**[群組命名會曝露給瀏覽器]** → `products` claim 帶的是群組名稱的第一段。現在的 `bonsale` / `bontalk` / `bonai` 沒問題;若哪天群組名本身帶有不想給客戶看到的資訊(例如內部代號),要改用對照表而非直接透出。

**[本 change 疊在尚未驗收的 change 上]** → `rebuild-portal-as-vite-launcher` 還有 19 項未驗(6 項 Authentik + 13 項瀏覽器驗證),而本 change 會改動同樣幾個檔案。已知並接受;緩解方式是**兩者的 commit 分開**,某項驗不過時才分得出是哪一層。

**[`import.meta.env.DEV` 的切換會讓本機看不到正式清單]** → 這是刻意的,但要知道「本機跑起來的樣子」與「正式環境的樣子」在產品清單這一塊本來就不同,驗收正式環境的清單只能在正式環境(或用 `npm run build` + `preview`)做。

## Migration Plan

1. **先在 Authentik 建好 `products` 的 scope mapping 並掛到 provider**(步驟見 `docs/authentik-product-entitlements.md`),以 discovery 的 `scopes_supported` 確認出現 `products`。
2. **程式**:先建 `src/products.ts`(此時還沒有過濾,行為與現在相同),再加 scope、再加過濾與三態 —— 每一步都能單獨跑起來看。
3. **移除** `VITE_PORTAL_PRODUCTS` 與 `src/utils/portalProducts.ts`。
4. 可選的 D8 獨立一組,最後做或不做。

**Rollback**:程式端 `git revert`。Authentik 端多一個 scope mapping 對舊版程式是**相容的**(沒要求該 scope 就不會拿到,也不會報錯),不需要一起回滾。

## Open Questions

- 正式環境三個產品的實際網址尚未定案。不影響設計與任務拆解(就是目錄裡的字串),但部署前要跟 Authentik 各產品 provider 的設定同時確認。
- 客戶是否全部都讀中文尚未確認。若之後要 i18n,產品的 `name` 欄位會需要從單一字串改成可翻譯的形式 —— 屆時本 change 的產品目錄結構要跟著調整,但不影響現在的決定。
