// 處理「登入完成後導回發起服務」的邏輯。
//
// 流程：
// 1. 公司其他服務發現使用者未登入，導向本 Portal：
//    https://portal.company.com/login?redirect_uri=https://service-a.company.com/
// 2. /login 頁面把 redirect_uri 存進 sessionStorage（先做網域白名單檢查，避免 open redirect）。
// 3. 使用者完成登入（Microsoft 或帳密）拿到 token 後，導回 redirect_uri，
//    token 帶在 URL fragment（#token=xxx，不會被送到伺服器 access log，也不會出現在 Referer）。
// 4. 目的服務的前端自行從網址讀出 token，存進自己的 storage，並把網址清乾淨。
//
// 安全性：redirect_uri 必須通過白名單檢查才會被採用，否則視為未提供（避免被利用來把 token
// 導到攻擊者網站的 open redirect 漏洞）。白名單透過 NEXT_PUBLIC_ALLOWED_REDIRECT_HOSTS 設定，
// 逗號分隔的網域後綴（例如 ".company.com"）；未設定時一律視為不允許，只會顯示登入成功訊息。

const REDIRECT_STORAGE_KEY = "sso_redirect_uri";

function getAllowedHostSuffixes(): string[] {
  const raw = process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_HOSTS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowedRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;

  const allowedSuffixes = getAllowedHostSuffixes();
  return allowedSuffixes.some((suffix) => url.hostname === suffix.replace(/^\./, "") || url.hostname.endsWith(suffix));
}

// 在 /login 頁面載入時呼叫，把網址上的 redirect_uri 存起來供登入完成後使用。
export function capturePendingRedirect(searchParams: string | undefined) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(searchParams ?? "");
  const redirectUri = params.get("redirect_uri");
  if (redirectUri && isAllowedRedirectUri(redirectUri)) {
    sessionStorage.setItem(REDIRECT_STORAGE_KEY, redirectUri);
  }
}

export function consumePendingRedirect(): string | null {
  if (typeof window === "undefined") return null;
  const redirectUri = sessionStorage.getItem(REDIRECT_STORAGE_KEY);
  sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
  if (redirectUri && isAllowedRedirectUri(redirectUri)) {
    return redirectUri;
  }
  return null;
}

// 登入成功、拿到 token 後呼叫：能找到合法的 redirect_uri 就導回去（token 帶在 fragment），
// 否則導到本地的登入成功頁面。
export function completeLoginWithToken(token: string) {
  const redirectUri = consumePendingRedirect();
  if (redirectUri) {
    const target = new URL(redirectUri);
    target.hash = `token=${encodeURIComponent(token)}`;
    window.location.href = target.toString();
    return;
  }
  // 這是一支給非 React 元件呼叫的 helper（沒有 useRouter 可用），且需要整頁導航
  // 而非 client-side transition，因此用 window.location 而非 next/navigation。
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/login/success";
}
