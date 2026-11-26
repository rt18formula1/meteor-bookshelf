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

/* 判型（書籍のサイズ）。値はDBの format カラムに保存する */
export const FORMAT_LABEL = {
  bunko: "文庫", shinsho: "新書", b6: "B6", shirokuban: "四六判",
  a5: "A5", kikuban: "菊判", b5: "B5", a4: "A4", other: "その他",
};
export const FORMAT_OPTIONS = [
  { value: "", label: "未設定" },
  { value: "bunko", label: "文庫" },
  { value: "shinsho", label: "新書" },
  { value: "b6", label: "B6" },
  { value: "shirokuban", label: "四六判" },
  { value: "a5", label: "A5" },
  { value: "kikuban", label: "菊判" },
  { value: "b5", label: "B5" },
  { value: "a4", label: "A4" },
  { value: "other", label: "その他" },
];
/* 判型ごとの物理的な高さ（mm） */
export const FORMAT_HEIGHT_MM = {
  bunko: 148, shinsho: 182, b6: 182, shirokuban: 188,
  a5: 210, kikuban: 220, b5: 257, a4: 297,
};
/* 物理的な高さ（mm）を棚の表示高さ（px）に換算する。
   文庫148mm→156px、新書/B6 182mm→185px、四六判188mm→190px、A5 210mm→209px、
   菊判220mm→217px、B5 257mm→248px、A4 297mm→282px（上限260pxで抑える）。
   文庫が明確に低く、A4・B5が明確に高く見える。150px未満・260px超にはしない */
export function mmToSpineHeight(mm) {
  const v = Number(mm);
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.max(150, Math.min(260, Math.round(v * 0.85 + 30)));
}
/* CD（ジュエルケース約125mm）の棚での高さ。文庫（156px）より明確に低い */
export const CD_SPINE_HEIGHT = 136;
/* 手動の高さ（mm）の正規化。空・不正は null、100〜300mmに収める */
export function normalizeHeightMm(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return Math.max(100, Math.min(300, n));
}
/* 書誌の高さ（mm）と表紙画像の比率から判型を推定する。確実でない場合は ""（未設定）。
   高さだけでは新書とB6は同じ182mmで区別できないため、比率で分ける（新書は約0.57と細長い）。
   高さが2つの判型の中間で曖昧な場合も未設定にする（誤った判型を入れない）。
   寸法がない場合は新書だけ比率で推定する（他の判型は比率がほぼ0.7で区別できない） */
export function detectFormat(heightMm, coverRatio) {
  const ratio = coverRatio ? Number(coverRatio) : null;
  const h = Number(heightMm);
  if (Number.isFinite(h) && h > 0) {
    const heights = [...new Set(Object.values(FORMAT_HEIGHT_MM))].sort((a, b) => a - b);
    const sorted = heights.map((mm) => ({ mm, d: Math.abs(mm - h) })).sort((a, b) => a.d - b.d);
    const best = sorted[0];
    const second = sorted[1];
    /* 最も近い判型が5mm以内で、2番目より2mm以上近い場合のみ採用 */
    if (best.d <= 5 && (!second || second.d - best.d >= 2)) {
      if (best.mm === 182) {
        if (ratio && ratio <= 0.62) return "shinsho";
        if (ratio && ratio >= 0.65) return "b6";
        return "";
      }
      const hit = Object.entries(FORMAT_HEIGHT_MM).find(([, mm]) => mm === best.mm);
      return hit ? hit[0] : "";
    }
    return "";
  }
  if (ratio && ratio >= 0.52 && ratio <= 0.62) return "shinsho";
  return "";
}

/* 背表紙サイズ: 種別とページ数（prog_total）で変化させる */
export function spineSize(item) {
  const h = hashCode(item.title || "");
  const bookWidth = item.prog_total > 0
    ? Math.max(48, Math.min(62, 44 + item.prog_total / 26))
    : 48 + (h % 15);
  /* 手動の高さ（mm）があれば最優先（CDの上限も解除する）。種別ごとの幅は従来通り */
  const manual = item.height_mm ? mmToSpineHeight(item.height_mm) : null;
  if (manual != null) {
    if (item.type === "cd") return { width: 23, height: manual };
    if (item.type === "dvd") return { width: 26, height: manual };
    if (item.type === "magazine") return { width: 54 + (h % 12), height: manual };
    if (item.type === "other") return { width: 40 + (h % 15), height: manual };
    return { width: bookWidth, height: manual };
  }
  /* CDは本より明確に低く（上限136px）。height_mm が明示された場合のみ上記で解除される */
  if (item.type === "cd") return { width: 23, height: CD_SPINE_HEIGHT };
  if (item.type === "dvd") return { width: 26, height: 185 };
  if (item.type === "magazine") return { width: 54 + (h % 12), height: 205 + (h % 28) };
  if (item.type === "other") {
    return { width: 40 + (h % 15), height: 182 + (h % 26) };
  }
  // book: 判型 → 従来のランダム（判型未設定の本は従来通りハッシュによる高さ）
  let height = null;
  if (item.format && FORMAT_HEIGHT_MM[item.format]) height = mmToSpineHeight(FORMAT_HEIGHT_MM[item.format]);
  if (height == null) {
    if (item.prog_total > 0) {
      height = Math.max(190, Math.min(232, 186 + item.prog_total / 16));
    } else {
      height = 192 + (h % 38);
    }
  }
  return { width: bookWidth, height };
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
        { label: "Apple Music で探す", href: `https://music.apple.com/jp/search?term=${q}` },
        { label: "YouTube Music で探す", href: `https://music.youtube.com/search?q=${q}` },
        { label: "LINE MUSIC で探す", href: `https://music.line.me/webapp/search?query=${q}` },
      ];
    case "book":
      return [
        { label: "Kindle で探す", href: `https://www.amazon.co.jp/s?k=${encodeURIComponent([item.title, item.creator].filter(Boolean).join(" "))}&i=digital-text` },
        { label: "Amazon で探す", href: `https://www.amazon.co.jp/s?k=${encodeURIComponent(item.isbn || item.title || "")}` },
        { label: "楽天ブックス で探す", href: `https://books.rakuten.co.jp/search?sitem=${encodeURIComponent(item.isbn || item.title || "")}` },
        { label: "VALUEBOOKS で探す", href: `https://www.valuebooks.jp/search?keyword=${encodeURIComponent(item.isbn || item.title || "")}` },
      ];
    case "dvd":
      return [
        { label: "Amazon で探す", href: `https://www.amazon.co.jp/s?k=${encodeURIComponent(item.catno || item.title || "")}` },
      ];
    case "magazine":
      /* 雑誌はJANコード（491始まり）であってISBNではないため、VALUEBOOKSは雑誌名で検索する */
      return [
        { label: "Amazon で探す", href: `https://www.amazon.co.jp/s?k=${titleQ}` },
        { label: "楽天ブックス で探す", href: `https://books.rakuten.co.jp/search?sitem=${encodeURIComponent(item.title || "")}` },
        { label: "VALUEBOOKS で探す", href: `https://www.valuebooks.jp/search?keyword=${encodeURIComponent(item.title || "")}` },
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
