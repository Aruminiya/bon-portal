# Authentik:讓客戶用 Google 帳號登入

> **Portal 程式端零改動。** 這份文件從頭到尾都在講 Authentik 的設定 ——
> `src/config/oidc.ts` 的 `authority`、`client_id`、`scope` 一個字都不用動。
> 原因見下面「為什麼 Portal 不用改」。

## 這是什麼

客戶除了業務給的帳密之外,也能用自己的 Google 帳號登入 Portal。

```
        ┌────────────────────────────────────────┐
        │              Authentik                 │
        │                                        │
 上游   │  Source               Provider         │   下游
Google ─┼─→ (Authentik 在這     (Authentik 在這 ─┼─→ Portal
        │   側是 client,去      側是 IdP,自己   │    BonSale
        │   跟 Google 問)        簽 token)       │    BonTalk
        └────────────────────────────────────────┘
```

**Google 是 Authentik 的上游,對 Portal 完全透明。** Authentik 的後台把這兩個方向分成
兩個選單,方向感不要弄反:

- **Source** = 上游,「我去跟誰問這個人是誰」← 這份文件只動這裡
- **Provider** = 下游,「誰來跟我問這個人是誰」← Portal 掛在這裡,不動

### 為什麼 Portal 不用改

因為 broker 不是把 Google 的 token 轉發下來,**而是自己重新簽一個**。

不管客戶是打帳密還是點 Google,Portal 拿到的 `id_token` 的 `iss` 永遠是
`VITE_AUTHENTIK_AUTHORITY`、`aud` 永遠是 Portal 的 client_id、`products` claim 永遠在。
Google 發的 token 在 Authentik 那裡就落地了,一滴都不會流到下游。

這跟 `src/products.ts` 的三態判讀能成立是同一件事的兩面:Portal 只需要相信一個簽名來源。

## 帳號連結策略:我們選 A(手動綁定)

客戶點「用 Google 登入」,Google 驗完身分把 `sub`(Google 給的永久使用者 ID)和 `email`
送回 Authentik 之後:

```
Authentik 查:這個 Google sub 有沒有連到我這邊的某個 user?
  ├─ 有 ──→ 直接登入,建立 authentik_session
  └─ 沒有 ─→ ???  ← 所有策略的差別,全部在這一格
```

| | 「沒有連結」時怎麼辦 | 選了嗎 |
|---|---|---|
| **A 手動綁定** | 拒絕。連結只能由「已登入的客戶主動去綁」產生 | ✅ |
| **B email 自動比對** | 拿 email 找既有帳號,找到就當場連結,找不到拒絕 | ❌ |
| **C 自動註冊** | 找不到就建一個新 user | ❌ |

A 的完整體驗:

1. 客戶用業務給的帳密登入(照舊)
2. 到 Authentik 的 user settings 按一次「連結 Google」
3. **之後**才能用 Google 登入

### 為什麼是 A

第 2 步發生的當下,Authentik 已經百分之百知道他是誰 —— 他剛用密碼證明過。所以連結
**不可能接錯人**,完全不依賴 email 比對。

而這個 app 的帳號本來就是業務簽約後手動開的,綁定多這一道手續由業務在交付時一起帶著做完,
不是額外負擔。A 的成本剛好落在「已經有人帶」的地方。

### B 為什麼不選

B 的問題不是「不安全」,是**它把「誰是誰」的判斷押在客戶公司的 IT 手上**,而那是我們
控制不到的地方。兩個不是理論上的情境:

- **業務打錯 email。** 帳號 `ming` 的 email 被填成同公司另一個人的。那個人用 Google
  登入,直接拿到 `ming` 這個帳號和它的 `bonsale` 群組。
- **email 被回收。** 王小明離職,客戶公司把 `ming@acme.com` 配給新來的人。新人用
  Google 登入 → 比對成功 → 繼承整個帳號。合約還在,但人已經換了。

A 沒有這兩個問題,因為判斷押在密碼上。

還有一個前提:B 要成立,來源回傳的 `email_verified` 必須是 `true`。Google Workspace 和
Gmail 都是,所以只接 Google 時實務上沒事 —— 但哪天再接一家(例如客戶自己的 Azure AD),
那家若允許使用者自填 email,這條路當場就破。A 不受這個影響。

**如果將來真的要改走 B**,至少要在 Source 上掛一條 policy 限制 email 網域白名單。
那擋不掉上面兩個情境,但至少「隨便一個 gmail 撞對 email」進不來。

### C 為什麼不選

C 的問題不在安全,在於它跟這個 app 的前提直接相反 —— `CLAUDE.md`:「帳號不開放自助註冊:
業務簽約後,由我們在 Authentik 預先建立帳號」。開了 C,任何有 Google 帳號的人都能在我們的
Authentik 裡長出一個 user。

> ⚠️ **不要用「反正他沒有群組,看到的是『目前沒有可使用的服務』」來說服自己 C 沒差。**
>
> 那句文案是寫給**付費客戶**看的(合約還沒開通、或到期)。拿它當陌生人的擋牆,等於把
> 它的語意稀釋掉 —— 這跟 `readEntitlements()` 刻意分三態要避免的是同一類錯誤:
> 把不同性質的狀況塞進同一個畫面。
>
> 另外使用者池會被灌進不明帳號,之後要查「這個客戶到底開了幾個帳號」就變成人工作業。

## 設定步驟

> 後台選單與欄位名稱依 Authentik 版本略有差異,以下用 2026.8.x 的介面。

### 1. Google Cloud Console:建立 OAuth Client

**APIs & Services → Credentials → Create Credentials → OAuth client ID**

| 欄位 | 值 |
|---|---|
| Application type | Web application |
| Authorized redirect URIs | `https://<你的authentik網域>/source/oauth/callback/google/` |

最後那個 `google` 是**下一步 Source 的 slug**,兩邊必須一致,結尾斜線也要有。先決定好 slug
再回來填,不然會改兩次。

拿到 **Client ID** 和 **Client Secret**,下一步要用。

> Client Secret 是真的機密,跟 Portal 的 `VITE_*` 不同 —— 它只存在 Authentik 裡,
> 不會進這個 repo,也不會出現在瀏覽器。

### 2. Authentik:建立 Google Source

**Directory → Federation and Social login → Create → Google OAuth Source**

| 欄位 | 值 | 為什麼 |
|---|---|---|
| **Name** | `Google` | 會出現在登入畫面的按鈕上 |
| **Slug** | `google` | 決定 callback URL,要跟步驟 1 一致 |
| **Consumer key** | 步驟 1 的 Client ID | |
| **Consumer secret** | 步驟 1 的 Client Secret | |
| **User matching mode** | `Link users on unique identifier`(預設值) | ← **A 的關鍵之一** |
| **Authentication flow** | `default-source-authentication` | 已連結的人靠這條進來 |
| **Enrollment flow** | **留空** | ← **A 的關鍵之二** |

這兩個「關鍵」合起來就是 A:

- `Link users on unique identifier` —— 只認 Google 的 `sub`,**完全不看 email**。沒有既有
  連結就是沒有,不會拿 email 去猜。
- **Enrollment flow 留空** —— 沒有連結的人走到這裡就沒有下一步了,Authentik 直接擋下。
  這一格填了任何東西,就變成 C。

> ⚠️ **Enrollment flow 是這整份設定裡唯一一個「填錯會靜默開放註冊」的欄位。**
> 它不會報錯,也不會有警告,症狀是「怎麼誰都登得進來」。改完 Source 之後回來確認一次。

### 3. 把 Source 加到登入畫面

光是建好 Source,登入畫面**不會**自動出現按鈕。

**Flows and Stages → Stages → `default-authentication-identification` → Edit → Sources**

把 `Google` 從左邊加到 **Selected**。

> ⚠️ 這步驟跟 `docs/authentik-product-entitlements.md` 裡「把 scope mapping 掛到
> provider 上」是同一個形狀的坑:東西建好了但沒掛上去,Authentik 不會抱怨,只是
> 什麼都不會發生。

### 4. 驗證綁定流程(客戶做的那一段)

用一個測試帳號:

1. 用帳密登入 Portal ✅
2. 開 `https://<你的authentik網域>/if/user/#/settings`
3. 找到 **Connected services**(或「已連結的服務」)→ Google 旁邊按 **Connect**
4. 跳到 Google 同意畫面 → 同意 → 回到 Authentik

第 3 步能成立的原因是:此時使用者**已經在 session 裡**,Authentik 知道要把這個 Google
帳號連到誰身上,所以走的是「連結」而不是「註冊」—— 這條路不經過 Enrollment flow,
所以步驟 2 把它留空不影響綁定。

### 5. 驗證 Google 登入

**先完全登出**(Portal 的登出按鈕 → SLO),再:

1. 進 Portal → 點登入 → Authentik 登入畫面上應該有「Google」按鈕
2. 點它 → 選剛才綁定的 Google 帳號 → 直接回到 Portal 且已登入
3. devtools 確認 `auth.user.profile.products` 跟用帳密登入時**完全一樣**

第 3 點是重點:**entitlement 跟登入方式無關。** `products` claim 來自 Authentik 的群組,
群組掛在 user 上,而 Google 登入進來的是同一個 user。

### 6. 驗證「沒綁過的人進不來」

拿一個**沒有綁定過**的 Google 帳號點登入 —— 應該被 Authentik 擋下(訊息大意是這個來源
沒有開放註冊)。

**這一步不要跳過。** 它是唯一能證明步驟 2 的 Enrollment flow 真的留空的方法。

## 上線後要知道的

### 登出不會結束 Google 的 session

Portal 的 SLO 結束的是 `authentik_session`,**Google 那邊還記得這個人**。所以客戶登出後
再點登入 → Google,可能一路靜默回來,看起來像「根本沒登出」。

這不是 bug,是 SSO 的正常行為,但客服會被問。要完全登乾淨只能請客戶去 Google 自己登出。

### 客戶換 email 不會斷掉連結

因為連結存的是 Google 的 `sub`,不是 email。客戶把 Google 帳號的 email 改了,連結照樣有效
—— 這是 `Link users on unique identifier` 順帶的好處,B 沒有。

反過來說:**要解除綁定只能從 Authentik 後台刪掉那筆 connection**,或客戶自己在
user settings 按 Disconnect。

### 這裡沒有新的安全邊界

Google 登入不改變 `docs/authentik-product-entitlements.md` 最後一節講的分工:Portal 的
產品清單過濾只是「別讓客戶看到進不去的連結」,真正的關卡在各產品自己那邊(產品自己跑
OIDC,Authentik 依 policy binding 決定放不放行)。

多一個登入方式,擋人的位置沒有變。

## 相關

- `CLAUDE.md` —— 這個 app 的架構與登入/登出流程
- `docs/authentik-product-entitlements.md` —— `products` scope 的設定(本文件的步驟 5
  會驗到它)
- 參考實作:`~/Desktop/Program/Demo/authentik/code/authentik-react-demo-app`
