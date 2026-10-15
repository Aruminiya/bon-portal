# Authentik:忘記密碼

> Portal 程式端零改動。「忘記密碼?」連結長在 Authentik 的登入頁上,點下去走的是
> Authentik 的 recovery flow。前提是寄信已設好,見 `docs/authentik-email.md`。

## 為什麼現在需要

以前帳號都是業務開的,忘記密碼找業務重設就好。開放 Google 自動建帳號、之後還有 email
自行註冊,這些人**沒有業務可以找**,所以一定要能自助重設。

## 流程長什麼樣

```
Flow authentication requirement: require_unauthenticated   ← 只有「未登入」的人能走
  │                                                            (已登入改密碼是另一條 Password change flow)
  ▼
Policy: default-recovery-skip-if-restored
  ├─ passed(一般情況)→ ① default-recovery-identification   輸入帳號或 email
  │                          ▼
  └─ denied ──────────→ ② default-recovery-email            寄重設信
                             ▼   ┄┄ 使用者收信、點連結(可以換一台裝置)┄┄
                         ③ Change your password(Prompt)    新密碼 ×2
                             ▼
                         ④ default-recovery-user-write      寫入
                             ▼
                         ⑤ default-recovery-user-login      自動登入
```

- **②→③ 可以跨裝置**:連結帶著 token,Authentik 用它找回「這是誰、走到哪一步」,
  不靠瀏覽器 cookie。電腦上申請、手機上點信接得上
- **那條 policy 只決定要不要跳過 ①。** 客戶自己按忘記密碼走的是 passed;denied 那條給
  「已經知道是哪個 user」的情況(推測是管理員從後台產生復原連結,未實測)
- **Google 自動建立的帳號沒有密碼**,他們按忘記密碼會走同一套、設好密碼之後兩種方式都能
  登入同一個帳號 —— 跟「一個 email 一個帳號」一致

## 設定步驟

### 1. 用內建範例 blueprint 建立 flow

範例檔內建在 Authentik 的 image 裡(`/blueprints/example/`),但**不會出現在藍圖清單**,
要自己建一筆:

**Customization → 藍圖 → New 藍圖**

| 欄位 | 值 |
|---|---|
| 姓名 | `Recovery with email verification` |
| 啟用中 | 開(關著的話永遠不會套用) |
| 路徑 → 本機路徑 | `example/flows-recovery-email-verification.yaml` |

建立後狀態是「未知」,**要按那一列的 ▶ 才會實際套用**,之後變成「成功」。

確認:**流程與階段 → 流程** 多了 `default-recovery-flow`(使用目的:救援),點進去
示意圖應該跟上面那張一樣。

> 下拉選單裡找不到這個路徑時,可以先在主機上確認檔案在不在:
> `docker compose exec worker ls /blueprints/example/`

### 2. 關掉這筆藍圖的「啟用中」

**藍圖 → 該列編輯 → 啟用中 關 → 更新。**

Blueprint 是宣告式的:之後若被重新套用,會把它管理的東西改回 YAML 寫的樣子,包括下一步
改的中文主旨。關掉後它建出來的 flow 與階段都還在,只是不會再被覆蓋。

**一定要在第 3 步之前做。** 清單裡那些 `Default - ...` / `System - ...` 不要關。

### 3. 信件主旨改成中文

**流程與階段 → 階段 → `default-recovery-email` → 編輯**

| 欄位 | 值 |
|---|---|
| 主旨 | `重設您的 Bon Portal 密碼` |
| 使用全域設定 | 勾選(用 `.env` 的 SMTP) |
| Token 過期時間 | 30 分鐘左右 |

信件**內文**仍是英文的預設範本,改中文要另外做自訂範本(待辦)。

### 4. 掛到登入頁

**Portal 的登入用的不是 Authentik 預設的 `default-authentication-flow`,而是
`google-authentication`:**

```
google-authentication(使用目的:身分認證)
  ├─ google-identification                      ← 帳號、密碼欄位與 Google 按鈕都在這一頁
  ├─ default-authentication-mfa-validation
  └─ default-authentication-login
```

所以要改的是 `google-identification`,**不是** `default-authentication-identification`
(改後者登入頁不會有任何變化):

**流程與階段 → 階段 → `google-identification` → 編輯 → 流程設定 → 救援流程**
→ 選 `default-recovery-flow` → Save Changes

> ⚠️ 下拉選單會列出所有 flow。選成 `google-authentication`(登入 flow 自己)的話,
> 「忘記密碼」點下去會繞回登入頁。

## 驗證

用**測試帳號**(密碼真的會被改掉),開無痕視窗:

1. 進 Portal → 登入 → Authentik 登入頁出現忘記密碼的連結
2. 點它 → 輸入測試帳號的 email → 收到信,主旨是中文
3. 點信裡的連結 → 設新密碼 → 自動登入回到 Portal
4. 登出,用新密碼再登入一次
5. 再點一次同一封信的連結 → 應該已失效

**Google 登入不會寄任何信**,這是正常的:Google 已經驗證過 email。要測這個 flow 一定要
從「忘記密碼」進去。

## 待辦

- [ ] 跑完上面 1–5 的完整驗證(2026-10-12 時只確認了連結有出現)
- [ ] 信件內文改中文(自訂 email 範本,compose 已掛載 `./custom-templates:/templates`)
- [ ] 確認 denied 那條路徑(管理員產生復原連結)是否如推測

## 相關

- `docs/authentik-email.md` —— SMTP
- `docs/authentik-google-login.md` —— 同一個登入頁上的 Google 按鈕
