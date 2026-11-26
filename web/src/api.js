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

/* Worker から返るエラーコードを分かりやすい日本語の案内に変換する */
const FRIENDLY_ERRORS = {
  email_not_verified: "メール確認が完了していません。確認メールのリンクを開いてから、もう一度お試しください。",
};
function toFriendlyError(error, status) {
  return FRIENDLY_ERRORS[error] || error || `エラー (${status})`;
}

export async function api(path, opts = {}) {
  const headers = await authHeaders(opts.headers || {});
  let res = await fetch(path, { ...opts, headers });
  let data = await res.json().catch(() => ({}));
  if (!res.ok && res.status === 401 && data.error === "email_not_verified") {
    /* 確認直後は古い ID トークン（email_verified=false）が残っていることがある。
       トークンを強制更新して1回だけやり直す。やり直しも同じエラーならそのまま返す */
    const u = auth.currentUser;
    if (u) {
      try {
        await u.getIdToken(true);
        const retryHeaders = await authHeaders(opts.headers || {});
        res = await fetch(path, { ...opts, headers: retryHeaders });
        data = await res.json().catch(() => ({}));
      } catch (_) {
        /* 強制更新に失敗した場合は、元の 401 をエラーとして扱う */
      }
    }
  }
  if (!res.ok) throw new Error(toFriendlyError(data.error, res.status));
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

/* 画像の自然な寸法（naturalWidth / naturalHeight）を取得する。失敗時は null。
   /api/images/ 配下は認証付きで取得した blob URL を使う（キャッシュされた URL は revoke しない）。
   外部 URL はそのまま読む（寸法の読み取りだけなら CORS は不要） */
export async function loadImageSize(src) {
  if (!src) return null;
  let url = src;
  try {
    if (src.startsWith("/api/images/")) {
      url = await apiImageObjectUrl(decodeURIComponent(src.slice("/api/images/".length)));
      if (!url) return null;
    }
    const size = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve({ width: im.naturalWidth || 0, height: im.naturalHeight || 0 });
      im.onerror = () => reject(new Error("load failed"));
      setTimeout(() => reject(new Error("timeout")), 8000);
      im.src = url;
    });
    if (!size.width || !size.height) return null;
    return size;
  } catch (_) {
    return null;
  }
}

/* ---------- フォルダ ---------- */
export const listFolders = () => api("/api/folders");
export const createFolder = (name) => apiJson("/api/folders", "POST", { name });
export const updateFolder = (id, patch) => apiJson(`/api/folders/${id}`, "PATCH", patch);
export const deleteFolder = (id) => api(`/api/folders/${id}`, { method: "DELETE" });
export const reorderFolders = (ids) => apiJson("/api/folders/reorder", "PUT", { ids });

/* 公開フォルダの取得（認証不要。api() は未ログイン時もそのまま送れる） */
export const getPublicFolder = (shareId) => api(`/api/public/folders/${encodeURIComponent(shareId)}`);

/* 本棚全体の公開設定（認証必須）。{ is_public, share_id, url } を返す */
export const getPublicCollectionSettings = () => api("/api/settings/public-collection");
export const updatePublicCollectionSettings = (patch) => apiJson("/api/settings/public-collection", "PUT", patch);

/* 本棚全体の公開ページ取得（認証不要） */
export const getPublicCollection = (shareId) => api(`/api/public/collection/${encodeURIComponent(shareId)}`);

/* 公開画像URL（認証不要）。item.image_key がある場合に使う */
export function publicImageUrl(key) {
  return key ? `/api/public/images/${encodeURIComponent(key)}` : "";
}
/* 公開ページでの表紙画像URL。ユーザー写真があれば公開画像URL、なければ外部表紙URL */
export function publicCoverSrc(item) {
  if (!item) return "";
  if (item.image_key) return publicImageUrl(item.image_key);
  if (item.cover_url) return item.cover_url;
  return "";
}
/* 公開ページでの棚用画像URL。棚と同じ優先順位（背表紙 → 表表紙 → 裏表紙 → 外部表紙） */
export function publicSpineSrc(item) {
  if (!item) return "";
  if (item.spine_key) return publicImageUrl(item.spine_key);
  if (item.image_key) return publicImageUrl(item.image_key);
  if (item.side_key) return publicImageUrl(item.side_key);
  if (item.cover_url) return item.cover_url;
  return "";
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
    throw new Error(toFriendlyError(d.error, res.status));
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
    throw new Error(toFriendlyError(d.error, res.status));
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
