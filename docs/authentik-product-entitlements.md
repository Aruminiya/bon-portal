# Authentik:讓 Portal 知道客戶買了哪些產品

> 程式端已實作:產品目錄在 `src/products.ts`,三態判讀在同檔的 `readEntitlements()`,
> scope 在 `src/config/oidc.ts`。這份文件是 Authentik 那一半的操作手冊。

## 為什麼需要這個

bon-portal 是**合約制**的客戶入口:客戶簽了什麼就能用什麼,每個客戶買的東西不一樣。
所以首頁的產品清單必須依登入者而不同 —— 而「誰買了什麼」這份資料本來就在 Authentik 裡
(簽約後由我們在後台設定權限),不需要另外做一套。

做法是讓 Authentik 在 `id_token` 裡多回一個 claim,Portal 拿它跟自己的產品目錄取交集。

```
Authentik 群組          →  claim            →  Portal 顯示
bonsale:admin           →  products:           BonSale
bonsale:reports            ["bonsale",          BonTalk
bontalk                     "bontalk"]
```

### 為什麼不直接用 `groups`

Authentik 的群組是 `bonsale` / `bontalk` / `bonai`,底下還有細節權限,命名空間是
`bonsale:<細節>`。直接把整包 `groups` 丟給 Portal 有三個問題:

1. **比對會出錯。** 只有 `bonsale:admin` 而沒有裸的 `bonsale` 的客戶,用
   `groups.includes('bonsale')` 會比對不到,明明有買卻看不到連結。要改成
   「等於產品名,或以產品名加冒號開頭」才對 —— 那層邏輯不如讓 Authentik 做掉。
2. **token 會變大。** 三個產品各十幾條細節權限就是幾十筆。而登出時 `id_token` 要當作
   `id_token_hint` 放進網址的查詢字串,我們的登出繞道又把整串 end-session URL 再塞進
   `next` 參數 —— token 越大這條 URL 越長,長到一定程度會撞到 Authentik 前面那層
   proxy 的 header buffer 上限(通常 4–8KB)。權限只有幾條不會有事,上百條就會,
   而且症狀很難查。
3. **Portal 不需要知道細節權限。** 它只要決定「顯示不顯示這個連結」,細節是各產品
   自己的事。

每個 provider 的 Scopes 是分開設定的,所以 BonSale 那個 provider 照常吐完整的 `groups`,
Portal 這個只吐 `products`,互不影響。

## 設定步驟

### 1. 確認群組結構

**使用者目錄 → 群組** —— 產品層級的群組必須存在:`bonsale`、`bontalk`、`bonai`。
細節權限用 `<產品>:<權限>` 的命名(例如 `bonsale:admin`)。

> 群組建立表單上的 **Parents** 與 **角色 (Roles)** 跟這個功能無關,留空即可。
> Parents 是群組繼承;Roles 是「這個人能對 Authentik 後台做什麼」,
> 不是「這個人能用我們哪些產品」。兩者不要混。

### 2. 建立 Scope Mapping

**Customization → Property Mappings → Create → Scope Mapping**

| 欄位 | 值 |
|---|---|
| **Name** | `Portal product entitlements`(只是後台的顯示名) |
| **Scope name** | `products` ← **client 請求時用的字串,是這個** |
| **Description** | 會出現在同意畫面,例如「您可使用的服務」 |
| **Expression** | 見下 |

```python
return {
    "products": sorted({g.name.split(":")[0] for g in request.user.ak_groups.all()}),
}
```

- `request.user.ak_groups.all()` —— 這個使用者的所有群組
- `g.name.split(":")[0]` —— `bonsale:admin` → `bonsale`
- `{...}` 是 set,自動去重:同一個產品的十幾條細節權限收斂成一筆
- `sorted(...)` 轉回 list 並固定順序 —— 不排序的話 set 順序不穩定,token 每次都不一樣,debug 時很討厭

> ⚠️ **Name 和 Scope name 是兩個不同的欄位,很容易填錯。**
> 填錯的症狀是:程式請求 `products`,Authentik 不報錯,但 claim 就是不出現。

### 3. 掛到 provider 上

**應用程式 → 供應商 → `bon-portal-app` 的 provider → 編輯 → Scopes**

把剛才那個 mapping 從左邊加到 **Selected**。

> ⚠️ 這一步漏掉的話,Authentik 會**靜默地**把 `products` 從請求裡交集掉 ——
> 跟 `offline_access` 那個坑一模一樣,不會有任何錯誤訊息。

### 4. 程式端加上 scope

`src/config/oidc.ts`:

```ts
scope: 'openid profile email offline_access products',
```

### 5. 重新登入

**改完一定要登出再登入。** 舊的 token 不會長出新 claim,拿舊 session 測會誤判成沒生效。

### 6. 驗證

登入後在 devtools 確認 `auth.user.profile.products` 是 `["bonsale", "bontalk"]` 這樣的陣列。

要直接看 token 內容的話在本機解,**不要貼到 jwt.io 之類的線上工具**:

```bash
# id_token 中間那段(兩個點之間)
echo '<payload段>' | base64 -d 2>/dev/null | python3 -m json.tool
```

## 程式端要注意的

### claim 有三種狀態,不要混在一起

| 狀態 | 意思 | 畫面應該顯示 |
|---|---|---|
| claim 不存在 | **設定錯了**(步驟 2 或 3 沒做對) | 「無法取得您的服務授權,請聯繫我們」 |
| `[]` | 這個帳號確實沒有任何產品 | 空清單的說明文字 |
| `["bonsale"]` | 正常 | 對應的產品連結 |

**設定錯誤不該看起來像「你沒有買任何東西」** —— 對客戶來說那是完全不同的兩件事。

### 非產品的群組也會進來

如果 Authentik 裡還有 `staff`、`admin` 之類的內部群組,它們也會出現在 `products` 陣列裡。
不用在 Authentik 那邊過濾 —— 前端是拿它跟產品目錄**取交集**,對不上的自然被忽略。

但要知道這個 claim **會把群組名稱的第一段曝露給瀏覽器**。以現在 `bonsale` / `bontalk` /
`bonai` 這種命名沒問題;如果哪天群組名本身帶有不想給客戶看到的資訊,要另外處理。

### 過濾不是安全邊界

Portal 的過濾只是「別讓客戶看到他進不去的連結」。客戶打開 devtools 改掉陣列一樣能看到
全部連結 —— 但點進去會被擋,因為**真正的關卡在各產品那邊**:產品自己跑 OIDC,
Authentik 依該 application 的 policy binding 決定放不放行。

這正是 launcher 模式的分工:Portal 不負責擋人,各產品自己擋。

## 相關

- `CLAUDE.md` —— 這個 app 的架構與登入/登出流程
- `openspec/changes/filter-products-by-entitlement/` —— 這個功能的規格與決定
- 參考實作:`~/Desktop/Program/Demo/authentik/code/authentik-react-demo-app`
  的 `CLAUDE.md` 有 `groups` scope mapping 的原始版本(本文件的步驟由它改寫而來)
