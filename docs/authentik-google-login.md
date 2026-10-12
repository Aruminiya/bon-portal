# Authentik:讓客戶用 Google 帳號登入

> **Portal 程式端零改動。** 這份文件從頭到尾都在講 Authentik 的設定 ——
> `src/config/oidc.ts` 的 `authority`、`client_id`、`scope` 一個字都不用動。
> 原因見下面「為什麼 Portal 不用改」。

## 這是什麼

客戶除了帳密之外,也能用自己的 Google 帳號登入 Portal。**沒有帳號的人用 Google 登入時,
Authentik 會自動幫他建立帳號** —— 對使用者來說,「用 Google 登入」和「用 Google 註冊」是
同一個按鈕。

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

## 帳號從哪裡來

開放註冊之後,帳號有三種來源。最右邊那欄是下面「一個 email 只對應一個帳號」能不能成立的關鍵:

| 來源 | 誰建立的 | email 有沒有確認過是本人的 |
|---|---|---|
| 業務開的帳號 | 業務在簽約後手動建立 | **沒有**,是業務輸入的 |
| 用 Google 登入 | 第一次用 Google 登入時自動建立 | 有,Google 已經確認過 |
| 自行註冊 | 使用者在註冊頁自己建立 | 有,必須點過我們寄的確認信 |

> 自行註冊(email + 密碼)與忘記密碼的 flow 還沒做,不在這份文件的範圍。這裡只先記下它
> 跟 Google 登入交會的那條規則:**先確認 email 才建立帳號**,所以它的 email 跟 Google 的
> 一樣可信。

## 原則:一個 email 只對應一個帳號

同一個人不管用密碼還是用 Google 登入,都要進到同一個 user,看到同樣的 `products`。

Authentik 預設不會阻止兩個 user 有相同的 email,所以什麼都不做的話,同一個人很容易長出兩個
帳號,買的服務只掛在其中一個上。兩個方向都要堵:

| 先發生的 | 後發生的 | 不處理會怎樣 | 處理方式 |
|---|---|---|---|
| 用 Google 登入(自動建帳號) | 用同一個 email 自行註冊 | 第二個帳號,沒有授權 | 註冊 flow 擋下重複 email,提示「請直接登入,或改用 Google 登入」(註冊 flow 的事,尚未實作) |
| 用 email 註冊 / 業務開帳號 | 用同 email 的 Google 登入 | Authentik 不認得這個 Google 帳號,又建一個新 user | **Source 的 User matching mode 改成用 email 連結** ← 這份文件負責的部分 |

```
Google 驗完身分,把 sub(Google 的永久使用者 ID)和 email 送回 Authentik:

這個 Google sub 有沒有連到某個 user?
  ├─ 有 ──────────────────────────────→ 直接登入
  └─ 沒有 → 有沒有 email 相同的 user?
              ├─ 有 ─→ 當場連結到那個 user,登入
              └─ 沒有 → 走 Enrollment flow,建立新 user(沒有任何群組)
```

### 代價:業務開的帳號,email 必須正確

「email 相同就是同一個人」只在 email 可信時成立。Google 和自行註冊的 email 都驗證過,
**業務開的帳號沒有** —— 它是人工輸入的。兩個會出事的情境:

- **業務打錯 email。** 小明帳號的 email 被填成同公司小華的。小華用自己的 Google 登入,
  Authentik 會把他連到小明的帳號,看到小明公司買的所有服務。
- **email 被回收。** 小明離職,客戶公司把 `ming@acme.com` 配給新人。新人用 Google 登入 →
  比對成功 → 接手整個帳號。

這兩個情境 Authentik 端擋不掉,所以靠流程補:**業務開帳號時再確認一次 email;得知客戶
有人離職或換 email 時,通知工程更新或停用該帳號。** 這是跟業務講好的分工,不是工程端的
疏漏。

> 曾經考慮過的另一條路是「只認 Google sub、不看 email,由已登入的客戶自己去 user settings
> 按『連結 Google』」(手動綁定)。它沒有上面兩個問題,但前提是帳號全部由業務開好、
> 業務在交付時帶客戶綁定。開放自行註冊與 Google 自動建帳號之後,這個前提不在了,所以改走
> email 連結。

**如果將來再接一家 Source**(例如客戶自己的 Azure AD),先確認它回來的 email 是驗證過的。
允許使用者自填 email 的來源,掛上 email 連結就等於讓任何人認領任何帳號。

### 我們接受的取捨:別人查得出某個 email 有沒有註冊過

註冊頁的「這個 email 已經註冊過」會讓人能逐一試出誰是我們的客戶。要完全避免,得改成每次
登入都寄驗證碼/登入連結的做法 —— 我們不採用,因為 Portal 是客戶每天進產品的入口,每次都要
收信太麻煩。真正保護帳號的是密碼與確認信,不是隱藏 email 是否存在。

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
| **User matching mode** | `Link to a user with identical email address` | ← 「一個 email 一個帳號」的 Google 那一半 |
| **Authentication flow** | `default-source-authentication`(或你們自訂的) | 已連結的人靠這條進來 |
| **Enrollment flow** | `default-source-enrollment`(或你們自訂的) | 沒帳號的人靠這條自動建帳號 |

兩個容易弄錯的地方:

- **User matching mode 的預設值是 `Link users on unique identifier`**,它只認 Google 的 `sub`、
  完全不看 email。留在預設值,「先用 email 註冊、後來改按 Google」就會長出第二個帳號 ——
  不會報錯,只是客戶會發現服務不見了。Authentik 在這個選項旁邊會標註安全疑慮,指的就是上面
  「業務開的帳號 email 必須正確」那一節。
- **Enrollment flow 留空 = 沒帳號的人用 Google 會被擋下。** 這是「不開放註冊」時期的設定,
  現在要填。

### 3. 把 Source 加到登入畫面

光是建好 Source,登入畫面**不會**自動出現按鈕。

**Flows and Stages → Stages → `default-authentication-identification` → Edit → Sources**

把 `Google` 從左邊加到 **Selected**。

> ⚠️ 這步驟跟 `docs/authentik-product-entitlements.md` 裡「把 scope mapping 掛到
> provider 上」是同一個形狀的坑:東西建好了但沒掛上去,Authentik 不會抱怨,只是
> 什麼都不會發生。

### 4. 驗證:沒帳號的 Google 會自動建帳號

拿一個 email 在 Authentik 裡**不存在**的 Google 帳號:

1. 進 Portal → 點登入 → 點「Google」→ 同意
2. 應該回到 Portal 且已登入,畫面是「目前沒有可使用的服務」(新 user 沒有任何群組)
3. Authentik 後台 **Directory → Users** 應該多一個 user,email 是那個 Google 帳號的

### 5. 驗證:同 email 會連到既有帳號

這一步是證明步驟 2 的 User matching mode 真的改過的唯一方法,**不要跳過**。

1. 在 Authentik 建一個測試 user,email 設成你某個 Google 帳號的 email,並給它一個產品群組
   (例如 `bonsale`)
2. 先用帳密登入 Portal,記下 devtools 裡的 `auth.user.profile.products`
3. **完全登出**(Portal 的登出按鈕 → SLO)
4. 改點「Google」→ 選那個 Google 帳號
5. 應該回到 Portal 看到**同樣的**產品;`products` 跟第 2 步**完全一樣**
6. Authentik 後台 **Directory → Users** 應該**沒有**多出新 user,而原本那個 user 的
   **Connected services / Sources** 裡多了一筆 Google 連結

第 5 點成立的原因:**entitlement 跟登入方式無關。** `products` claim 來自 Authentik 的群組,
群組掛在 user 上,而 Google 登入進來的是同一個 user。

如果第 6 步看到多了一個 user,就是 matching mode 還停在預設值。

## 上線後要知道的

### 登出不會結束 Google 的 session

Portal 的 SLO 結束的是 `authentik_session`,**Google 那邊還記得這個人**。所以客戶登出後
再點登入 → Google,可能一路靜默回來,看起來像「根本沒登出」。

這不是 bug,是 SSO 的正常行為,但客服會被問。要完全登乾淨只能請客戶去 Google 自己登出。

### 連結建立之後,認的是 sub 不是 email

email 比對只發生在「第一次、還沒有連結」的那一刻。連結一旦建立,之後都靠 Google 的 `sub`
找人 —— 客戶之後改了 Google 帳號的 email,連結照樣有效。

反過來說:**要解除連結只能從 Authentik 後台刪掉那筆 connection**,或客戶自己在
user settings 按 Disconnect。處理「email 被回收」時,除了改 user 的 email,也要檢查並
刪掉舊的 Google 連結,不然原本那個 Google 帳號還是進得來。

### 自動建立的帳號沒有任何授權

Google 自動建立的 user 不在任何產品群組裡,登入後看到的是「目前沒有可使用的服務」。授權
仍然只來自 Authentik 的群組,登入方式不會給任何人權限。

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
