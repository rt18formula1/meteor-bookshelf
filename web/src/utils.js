export const TYPE_LABEL = { book: "書籍", cd: "CD", dvd: "DVD", magazine: "雑誌", other: "その他" };
export const TYPE_BADGE = { book: "BOOK", cd: "CD", dvd: "DVD", magazine: "MAG", other: "ITEM" };
export const STATUS_LABEL = { unread: "未読", reading: "読み進め中", done: "読了" };
export const TYPE_FILTERS = [
  { value: "", label: "すべて" },
  { value: "book", label: "書籍" },
  { value: "cd", label: "CD" },
  { value: "dvd", label: "DVD" },
  { value: "magazine", label: "雑誌" },
  { value: "other", label: "その他" },
];

/* 彩度を抑えた多色パレット（深緑・紺・臙脂・墨・生成りを含む） */
export const SPINE_COLORS = [
  "#33566b", // 藍鉄
  "#1f3a5f", // 紺
  "#51683c", // 苔緑
  "#2e5339", // 深緑
  "#71363f", // 臙脂
  "#7a2e2e", // 海老茶
  "#3f4a5a", // 墨紺
  "#2b2b30", // 墨
  "#8c6d3f", // 黄土
  "#b8620a", // 琥珀（ブランド色）
  "#6d4c2f", // 焦茶
  "#5b4a68", // 藤紫
  "#96613a", // オーク茶
  "#44554d", // 青磁鼠
  "#c9b18c", // 生成り
  "#7c4a56", // 梅紫
];
/* 生成りなど明るい背表紙では文字色を暗くする */
const DARK_TEXT_COLORS = new Set(["#c9b18c"]);

export function hashCode(str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function spineColor(item) {
  return SPINE_COLORS[hashCode(item.title + ":" + item.id) % SPINE_COLORS.length];
}
export function spineTextColor(item) {
  return DARK_TEXT_COLORS.has(spineColor(item)) ? "#3a2a16" : "#fff8f0";
}

/* 背表紙サイズ: 種別とページ数（prog_total）で変化させる */
export function spineSize(item) {
  const h = hashCode(item.title || "");
  if (item.type === "cd") return { width: 23, height: 150 };
  if (item.type === "dvd") return { width: 26, height: 185 };
  if (item.type === "magazine") return { width: 54 + (h % 12), height: 205 + (h % 28) };
  if (item.type === "other") {
    return { width: 40 + (h % 15), height: 182 + (h % 26) };
  }
  // book
  if (item.prog_total > 0) {
    return {
      width: Math.max(48, Math.min(62, 44 + item.prog_total / 26)),
      height: Math.max(190, Math.min(232, 186 + item.prog_total / 16)),
    };
  }
  return { width: 48 + (h % 15), height: 192 + (h % 38) };
}

export function coverSrc(item) {
  if (!item) return "";
  if (item.image_key) return `/api/images/${encodeURIComponent(item.image_key)}`;
  if (item.cover_url) return item.cover_url;
  return "";
}

/* 棚に並べたときの見た目: 背表紙の写真 → 表表紙 → 裏表紙の写真の順で使う */
export function spineSrc(item) {
  if (!item) return "";
  if (item.spine_key) return `/api/images/${encodeURIComponent(item.spine_key)}`;
  const cover = coverSrc(item);
  if (cover) return cover;
  if (item.side_key) return `/api/images/${encodeURIComponent(item.side_key)}`;
  return "";
}

/* 価格の表示整形: 数値だけなら ¥1,650 形式、それ以外はそのまま */
export function fmtPrice(price) {
  const s = String(price || "").trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return "¥" + Number(s).toLocaleString("ja-JP");
  return s;
}

/* 外部サービスへの検索リンク（種別に応じて出し分け） */
export function externalLinks(item) {
  if (!item) return [];
  const q = encodeURIComponent([item.creator, item.title].filter(Boolean).join(" ").trim() || item.title || "");
  const titleQ = encodeURIComponent(item.title || "");
  switch (item.type) {
    case "cd":
      return [
        { label: "Spotify で探す", href: `https://open.spotify.com/search/${q}` },
        { label: "Amazon Music で探す", href: `https://music.amazon.co.jp/search/${q}` },
      ];
    case "book":
      return [
        { label: "Kindle で探す", href: `https://www.amazon.co.jp/s?k=${encodeURIComponent([item.title, item.creator].filter(Boolean).join(" "))}&i=digital-text` },
        { label: "Amazon で探す", href: `https://www.amazon.co.jp/s?k=${encodeURIComponent(item.isbn || item.title || "")}` },
      ];
    case "dvd":
      return [
        { label: "Amazon で探す", href: `https://www.amazon.co.jp/s?k=${encodeURIComponent(item.catno || item.title || "")}` },
      ];
    default:
      return [
        { label: "Amazon で探す", href: `https://www.amazon.co.jp/s?k=${titleQ}` },
      ];
  }
}

export function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function progressPct(item) {
  if (!item || !item.prog_total) return 0;
  return Math.min(100, Math.round((item.prog_cur / item.prog_total) * 100));
}
