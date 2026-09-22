# Spec Delta

## Purpose

Portal 自身對 Authentik 的登入、登入狀態維持與登出。Portal 在這裡只管自己這個 relying party 的 session —— 建立起來的 Authentik SSO session 才是其他產品靜默登入的依據。

## ADDED Requirements

### Requirement: 使用者以 Authentik 帳號登入 Portal

Portal SHALL 透過 OIDC Authorization Code Flow 向 Authentik 取得使用者身分,且 MUST NOT 自行收集或傳遞帳號密碼。登入成功後,使用者在 Authentik 的 SSO session(`authentik_session` cookie)即已建立。

#### Scenario: 尚未有 SSO session 時登入

- **WHEN** 使用者在 Portal 點擊「登入」,且瀏覽器沒有有效的 Authentik SSO session
- **THEN** 瀏覽器整頁導向 Authentik 的授權頁面,使用者在 Authentik(而非 Portal)輸入憑證
- **AND** 完成後導回 Portal 的 `redirect_uri`,Portal 顯示為已登入

#### Scenario: 已有 SSO session 時登入

- **WHEN** 使用者在 Portal 點擊「登入」,且瀏覽器已有有效的 Authentik SSO session
- **THEN** Authentik 不再詢問憑證,直接導回 Portal
- **AND** Portal 顯示為已登入

#### Scenario: 使用者在 Authentik 取消或拒絕授權

- **WHEN** Authentik 以 `error` 參數導回 Portal 的回呼網址
- **THEN** Portal 顯示可讀的錯誤訊息與重新登入的入口
- **AND** Portal MUST NOT 顯示為已登入

### Requirement: 授權請求必須帶 PKCE 與 nonce

Portal 是沒有 client secret 的 public client,授權請求 MUST 帶 `code_challenge`(`S256`)與 `state`,且 MUST 帶 `nonce` 並在收到 `id_token` 後驗證其 `nonce` claim 與送出值相符。要求的 scope MUST 包含 `openid profile email offline_access`。

#### Scenario: 授權請求的內容

- **WHEN** Portal 發起授權請求
- **THEN** 請求 MUST 含 `response_type=code`、`code_challenge_method=S256`、`code_challenge`、`state`、`nonce`
- **AND** 請求 MUST NOT 含 client secret

#### Scenario: 回呼的 state 或 nonce 不符

- **WHEN** 回呼帶回的 `state` 與送出值不符,或換回的 `id_token` 的 `nonce` 與送出值不符
- **THEN** Portal MUST 拒絕這次登入並顯示錯誤,MUST NOT 進入已登入狀態

#### Scenario: Authentik 未開放 offline_access

- **WHEN** Authentik 的 provider 未設定 `offline_access` scope mapping
- **THEN** Authentik 會靜默地把該 scope 從請求中交集掉而不報錯,Portal 因此拿不到 refresh token
- **AND** 這屬於部署設定錯誤,MUST 在部署前以 discovery 文件的 `scopes_supported` 驗證,而非由 Portal 在執行期補救

### Requirement: 登入狀態必須跨重新整理保持並自動續期

Portal SHALL 在同一個瀏覽器 session 內保持登入狀態,並在 token 接近過期時以 refresh token 自動續期,不打斷使用者。

#### Scenario: 重新整理頁面

- **WHEN** 已登入的使用者重新整理 Portal 任一頁面
- **THEN** 使用者仍為已登入,不需要再次跑一次授權流程

#### Scenario: token 接近過期

- **WHEN** 目前的 token 接近過期且持有有效的 refresh token
- **THEN** Portal 在背景靜默續期,使用者不會被導走也不會看到中斷

#### Scenario: 續期失敗

- **WHEN** 靜默續期失敗(例如 refresh token 已失效)
- **THEN** Portal 回到未登入狀態並顯示登入入口,MUST NOT 停在一個宣稱已登入但實際無憑證的畫面

### Requirement: 回呼網址必須在交換完成後清乾淨

授權碼只能兌換一次。Portal SHALL 在完成 code 交換後,把 `code` / `state` 從瀏覽器網址列移除,且重複觸發的回呼處理 MUST NOT 造成第二次兌換。

#### Scenario: 回呼完成

- **WHEN** Portal 完成 code 交換
- **THEN** 網址列不再含 `code` 或 `state`
- **AND** 使用者停留在 Portal 首頁,看到已登入的內容

#### Scenario: 回呼處理被重複觸發

- **WHEN** 回呼頁面的處理邏輯在同一次載入中被觸發兩次(例如開發模式下的重複掛載)
- **THEN** 只會有一次 code 兌換,畫面 MUST NOT 因為第二次觸發而顯示失敗

### Requirement: 登出必須結束 Authentik 的 SSO session

Portal 的「登出」SHALL 結束使用者在 Authentik 的 SSO session(完整 SLO),使其他產品下次導向 Authentik 時不會被靜默登入。登出請求 SHALL 帶 `id_token_hint`,其來源 MUST 是目前登入 session 持有的 `id_token`。

#### Scenario: 已登入時登出

- **WHEN** 已登入的使用者點擊「登出」
- **THEN** 瀏覽器導向 Authentik 的 end-session 端點,帶上 `id_token_hint` 與 `post_logout_redirect_uri`
- **AND** Authentik 的 SSO session 被結束,使用者導回 Portal 且顯示為未登入
- **AND** 其他產品下次跑 OIDC 時 MUST 重新要求登入

#### Scenario: 連續登出多次

- **WHEN** 使用者在同一個瀏覽器連續完成多次「登入 → 登出」
- **THEN** 每一次登出都 MUST 導向可見的結果(導回 Portal 或身分提供者的已登出頁)
- **AND** MUST NOT 停在一個內容為空的成功回應上
- **AND** 每一次的 SSO session 都 MUST 確實被結束,而非只是畫面看起來完成了

#### Scenario: post_logout_redirect_uri 的比對

- **WHEN** Portal 帶出 `post_logout_redirect_uri`
- **THEN** 該值 MUST 與 Authentik provider 上註冊的 logout redirect URI **逐字**相同(含結尾斜線的有無),否則登出會被擋成 `invalid_request`

#### Scenario: 身分提供者未提供 end-session 端點

- **WHEN** 身分提供者的探索文件中沒有 end-session 端點
- **THEN** 這是身分提供者端的設定缺漏,Portal SHALL 以錯誤訊息呈現
- **AND** MUST NOT 靜默地讓登出按鈕看起來成功卻什麼都沒做

### Requirement: 使用者身分僅供 Portal 自身顯示

Portal 取得的 `id_token` SHALL 只用於顯示目前登入者與作為登出的 `id_token_hint`。Portal MUST NOT 將其傳遞給任何其他服務。

#### Scenario: 顯示登入者

- **WHEN** 使用者已登入
- **THEN** Portal 可顯示其 email / 使用者名稱等身分資訊
- **AND** 該憑證 MUST NOT 出現在任何導向其他來源的網址、請求標頭或請求內容中
