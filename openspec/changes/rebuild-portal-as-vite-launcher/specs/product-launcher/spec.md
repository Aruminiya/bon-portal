# Spec Delta

## Purpose

登入後呈現使用者可以進入的內部產品清單,並劃清「Portal 只給入口,不給憑證」這條邊界 —— 每個產品自己對 Authentik 跑一次 OIDC 補完登入。

## ADDED Requirements

### Requirement: 首頁依登入狀態決定內容

Portal 首頁 SHALL 同時是登入入口與產品清單:未登入時提供登入動作,已登入時列出產品連結。Portal MUST NOT 另設獨立的登入頁或登入成功頁。

#### Scenario: 未登入時開啟首頁

- **WHEN** 未登入的使用者開啟 Portal 首頁
- **THEN** 頁面顯示登入入口
- **AND** MUST NOT 顯示產品連結

#### Scenario: 已登入時開啟首頁

- **WHEN** 已登入的使用者開啟 Portal 首頁
- **THEN** 頁面顯示產品連結清單與登出入口

#### Scenario: 登入狀態尚未確定

- **WHEN** 頁面已渲染但登入狀態還在確認中
- **THEN** 頁面 MUST NOT 同時顯示登入與登出入口,也 MUST NOT 先閃一次錯誤的狀態

### Requirement: 產品清單來自部署設定

產品清單 SHALL 由部署時提供的設定決定,格式為**逗號分隔的完整 URL**。每筆項目的顯示名稱 SHALL 取自該 URL 的 host。Portal MUST NOT 在程式碼中寫死任何產品。

#### Scenario: 設定三個產品

- **WHEN** 設定為 `https://a.example.com,https://b.example.com,https://c.example.com`
- **THEN** 清單顯示三筆,名稱分別為 `a.example.com`、`b.example.com`、`c.example.com`

#### Scenario: 未設定產品清單

- **WHEN** 產品清單設定為空或未提供
- **THEN** 首頁顯示空清單的說明文字,MUST NOT 報錯或白畫面

### Requirement: 單筆設定錯誤不得讓整份清單消失

清單解析 SHALL 逐筆處理:任何一筆無法解析成合法 URL 的項目 MUST 被略過,其餘項目 MUST 正常顯示。

#### Scenario: 其中一筆不是合法 URL

- **WHEN** 設定為 `https://a.example.com,not-a-url,https://c.example.com`
- **THEN** 清單顯示 `a.example.com` 與 `c.example.com` 兩筆
- **AND** MUST NOT 因為中間那筆而顯示成空清單

#### Scenario: 多餘的空白與逗號

- **WHEN** 設定為 `  https://a.example.com , ,https://c.example.com,  `
- **THEN** 清單顯示兩筆,前後空白被去除,空項目被略過

### Requirement: 產品連結不得攜帶任何憑證

產品連結的網址 SHALL 就是該產品的入口路徑本身。Portal MUST NOT 在網址的查詢字串、fragment 或任何其他管道附加 `id_token`、`access_token` 或其他憑證。使用者到達產品後的登入,由該產品自行跑一次 OIDC 完成。

#### Scenario: 點擊產品連結

- **WHEN** 已登入的使用者點擊某個產品連結
- **THEN** 瀏覽器導向的網址與設定中的 URL 完全相同,不含任何附加參數
- **AND** 該產品因瀏覽器已帶有 Authentik SSO session 而不需再次輸入密碼

#### Scenario: 產品自身的登入失效

- **WHEN** 某個產品的 OIDC 流程失敗
- **THEN** 那是該產品與 Authentik 之間的事,Portal 的登入狀態 MUST NOT 受影響

### Requirement: 產品以同分頁的普通連結開啟

產品連結 SHALL 是同一個分頁的普通超連結。Portal MUST NOT 以 iframe 內嵌產品,亦 MUST NOT 預設以新分頁開啟。

#### Scenario: 連結的開啟方式

- **WHEN** 使用者點擊產品連結
- **THEN** 在目前分頁導向該產品

#### Scenario: 為什麼不能用 iframe

- **WHEN** 任何情境下考慮以 iframe 內嵌產品或 Authentik 頁面
- **THEN** MUST NOT 這麼做 —— Authentik 回應 `X-Frame-Options: DENY`,iframe 內一律是空白畫面,不分是否同網域

### Requirement: Portal 不再提供憑證轉交入口

Portal MUST NOT 接受 `redirect_uri` 查詢參數作為登入後的導向目標,亦 MUST NOT 以網址 fragment 交付憑證給任何外部網址。既然沒有跨網域導回,導向目標的網域白名單也 MUST NOT 存在。

#### Scenario: 舊的轉交網址

- **WHEN** 有人開啟帶 `?redirect_uri=https://other.example.com/` 的 Portal 網址
- **THEN** 該參數被忽略,使用者留在 Portal
- **AND** MUST NOT 有任何憑證被導向該網址

#### Scenario: 舊路由或任何未知路徑

- **WHEN** 有人開啟舊的 `/login`、`/login/success` 或任何其他路徑
- **THEN** 使用者落在首頁,網址列被正規化為 `/`
- **AND** MUST NOT 出現伺服器的 404 頁面(Portal 只有首頁一個畫面)
