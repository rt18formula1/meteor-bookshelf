/* API ラッパー。認証は Firebase Authentication。
   全リクエストに Authorization: Bearer <IDトークン> を付与する。
   トークンのキャッシュ・自動更新は Firebase SDK に任せる。
   401 が返った場合は呼び出し側にエラーを返すのみ（画面遷移は onAuthStateChanged 側で管理）。 */
import { auth } from "./firebase.js";

async function authHeaders(extra = {}) {
  const headers = { ...extra };
  const u = auth.currentUser;
  if (u) {
    try {
      headers.Authorization = `Bearer ${await u.getIdToken()}`;
    } catch (_) { /* トークン取得失敗時はヘッダーなしで送り、401 をエラーとして扱う */ }
  }
  return headers;
}

export async function api(path, opts = {}) {
  const headers = await authHeaders(opts.headers || {});
  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `エラー (${res.status})`);
  return data;
}

export function apiJson(path, method, body) {
  return api(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* 認証付きで画像を取得し、object URL を返す（<img> では Authorization を付けられないため）。
   同じキーは再取得しないようキャッシュする */
const imageUrlCache = new Map();
export function apiImageObjectUrl(key) {
  if (!key) return Promise.resolve("");
  if (!imageUrlCache.has(key)) {
    const p = (async () => {
      const headers = await authHeaders();
      const res = await fetch(`/api/images/${encodeURIComponent(key)}`, { headers });
      if (!res.ok) throw new Error(`画像の取得に失敗しました (${res.status})`);
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    })();
    p.catch(() => imageUrlCache.delete(key));
    imageUrlCache.set(key, p);
  }
  return imageUrlCache.get(key);
}

/* CSV をダウンロードする（絞り込みパラメータ対応: type, q, unread, withMemo） */
export async function downloadCsv(params = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v != null) clean[k] = v;
  }
  const qs = new URLSearchParams(clean);
  const headers = await authHeaders();
  const res = await fetch(`/api/export.csv?${qs}`, { headers });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `エラー (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="([^"]+)"/);
  a.href = url;
  a.download = m ? m[1] : "bookshelf.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* Excel (.xlsx) でダウンロードする。表データは /api/export.json から取得し、
   SheetJS でブックを組み立てる（ライブラリは動的 import で遅延読み込み）。 */
export async function downloadXlsx(params = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v != null) clean[k] = v;
  }
  const qs = new URLSearchParams(clean);
  const headers = await authHeaders();
  const res = await fetch(`/api/export.json?${qs}`, { headers });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `エラー (${res.status})`);
  }
  const data = await res.json();
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([data.header, ...(data.rows || [])]);
  ws["!cols"] = (data.header || []).map((_, i) => ({ wch: i === 2 ? 36 : 15 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "蔵書");
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}`;
  XLSX.writeFile(wb, `bookshelf-${stamp}.xlsx`);
}
