// SWR fetcher，仿照公司主要產品（bonvies/packages/fetcher）的慣例：
// - key 可以是純路徑字串，或 [路徑, RequestInit] tuple（可帶額外 headers）
// - 非 GET 用 sendRequest(method) 搭配 useSWRMutation，arg 當作 JSON body
// - 失敗時直接 throw Error(後端回傳的 error 訊息)，不另外包裝成自訂 Error class

const API_BASE_URL = process.env.NEXT_PUBLIC_SSO_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_SSO_API_BASE_URL 未設定，請在 .env.local 內指定既有 SSO 後端位址");
}

type Key = string | [string, RequestInit];

function resolveKey(key: Key): [string, RequestInit | undefined] {
  return typeof key === "string" ? [key, undefined] : key;
}

// 後端所有路徑前面都會加 /api，統一在這裡處理，endpoint 定義（lib/ssoApi.ts）就不用每支重複寫。
function resolveUrl(path: string): string {
  return `${API_BASE_URL}/api${path}`;
}

async function parseResponse(res: Response) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? `HTTP ${res.status}`);
  }
  return data;
}

export async function fetcher(key: Key) {
  const [path, init] = resolveKey(key);
  const res = await fetch(resolveUrl(path), {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  return parseResponse(res);
}

export function sendRequest<Arg>(method: "POST" | "PUT" | "PATCH" | "DELETE") {
  return async (key: Key, { arg }: { arg: Arg }) => {
    const [path, init] = resolveKey(key);
    const res = await fetch(resolveUrl(path), {
      ...init,
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init?.headers,
      },
      body: JSON.stringify(arg),
    });
    return parseResponse(res);
  };
}
