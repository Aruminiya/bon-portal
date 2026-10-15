# Authentik:寄信(SMTP)設定

> 註冊確認信、忘記密碼的重設信,都靠這裡寄出。Portal 程式端不涉及。

## 現況

| 項目 | 值 |
|---|---|
| Authentik | `authentik-sso.bonvies.com`,2026.8.1 |
| SMTP | Google Workspace(`smtp.gmail.com:587`,STARTTLS) |
| 寄件帳號 | `leo@bonvies.com`(**暫時**,見下方「待辦」) |
| 驗證 | `ak test_email` 已收到信,進收件匣、沒被歸到垃圾信 |

## 設定在哪裡

**全域的 SMTP 設定只能用環境變數,後台沒有畫面。** 寫在 `docker-compose.yml` 旁邊的
`.env`:

```bash
AUTHENTIK_EMAIL__HOST=smtp.gmail.com
AUTHENTIK_EMAIL__PORT=587
AUTHENTIK_EMAIL__USE_TLS=true
AUTHENTIK_EMAIL__USE_SSL=false
AUTHENTIK_EMAIL__USERNAME=<寄件帳號>
AUTHENTIK_EMAIL__PASSWORD=<該帳號的應用程式密碼,16 碼不含空格>
AUTHENTIK_EMAIL__FROM=<寄件帳號>
AUTHENTIK_EMAIL__TIMEOUT=10
```

官方 compose 的 `server` 與 `worker` 都有 `env_file: - .env`,所以加在 `.env` 就會注入
容器,**compose 檔不用改**。

> `.env` 在官方 compose 裡有兩種用途,容易混:
> - `${AUTHENTIK_TAG:-2026.8.0}` 這種 —— compose 讀 yml 時做字串替換
> - `env_file: .env` —— 每一行原封不動變成容器的環境變數
>
> SMTP 走的是後者,不需要在 `environment:` 再列一次。

容易踩的:

- **變數中間是兩個底線**(`EMAIL__HOST`)。打成一個會被靜默忽略,不報錯
- **port 與加密要成對**:587 配 `USE_TLS=true`(STARTTLS);465 配 `USE_SSL=true`。
  兩個不能同時 true。25 不要用(GCP 等雲端預設封鎖對外 25)
- **密碼是應用程式密碼**,不是登入密碼。要先開兩步驟驗證才拿得到。用錯會回
  `535 Username and Password not accepted` 或 `534 5.7.9 Please log in with your web browser`
- 應用程式密碼是真的機密 —— 只放在伺服器的 `.env`,不進任何 repo

## 生效與驗證

環境變數只在容器**啟動時**讀一次。改完要重建容器(資料在 Postgres volume,不受影響,
使用者也不會被登出):

```bash
docker compose up -d                                    # restart 不夠,不會重讀 .env
docker compose exec worker env | grep AUTHENTIK_EMAIL   # 確認變數真的進了容器
docker compose exec worker ak test_email <收件信箱>     # 寄一封測試信
```

- `ak` 是 Authentik 內建的 CLI,`test_email` 用**全域設定**寄一封固定內容的測試信
- **在 `worker` 上測**:實際寄信的是 worker(背景工作),server 測過不代表 worker 拿到了設定
- 要在跑 Authentik 的那台主機、compose 檔所在的資料夾執行

## 另一個設定位置:個別 Email 階段

後台每個 Email 階段都有「使用全域設定」。取消勾選就能在該階段另填一組 SMTP,存檔即生效、
不用重啟。**目前全部保持勾選**,原因:

- 一個地方管:換密碼不會漏改某一個階段
- `ak test_email` 測不到階段自己的那組
- 密碼不在資料庫裡,匯出 flow / blueprint 不會一起帶出去

## 寄件帳號的信箱裡會有每一封信的副本

透過 `smtp.gmail.com` 寄出的信,Gmail 一律在**寄件帳號的「寄件備份」**留一份副本 ——
對 Gmail 來說那就是這個帳號寄出的信,這個行為關不掉。所以註冊確認信、重設密碼信,
寄件帳號的信箱裡全都有。

副本是完整的信,**包含還沒過期的確認連結與重設密碼連結**。能看到這個信箱的人,
可以在使用者之前點下重設密碼連結,進到別人的帳號。所以:

- 寄件帳號的信箱**只給必要的人存取**,不要設成共用信箱或轉寄給一群人
- 連結有效時間維持短(目前 Email 階段設 `minutes=30`)

## 待辦

- [ ] **寄件帳號換成 `noreply@bonvies.com`**(請 Workspace 管理員開)。現在綁在個人帳號
  上:那個人改密碼或帳號停用,應用程式密碼全部失效,註冊與忘記密碼會同時壞掉。
  換的時候只改 `USERNAME` / `PASSWORD` / `FROM` 三行再 `docker compose up -d`
- [ ] 在 Gmail「顯示原始郵件」確認 SPF / DKIM / DMARC 都是 `PASS`
- [ ] 量變大或需要追蹤送達率時,考慮改用專門的寄信服務(SES、Postmark 等)。
  Authentik 只認 SMTP,換服務只動 `.env`

## 相關

- `docs/authentik-password-recovery.md` —— 第一個用到寄信的 flow
- 學習用的範例(手動講 SMTP、各種設錯的樣子):`~/Desktop/Program/Test/TEST_smtp/code`
