/* 共有カード（PNG）と共有PDFの生成。すべてクライアント側で行う。
   日本語は Canvas に描画して画像化するため、フォントの問題が出ない。
   表紙画像は取得できない場合があるため、取得失敗時は色タイル＋頭文字で代替表示する
   （Canvas が汚染されると toBlob が使えなくなるため、取得失敗した画像は描画しない）。
   PDF の文字はすべて Canvas 内に描く。jsPDF の doc.text は日本語を扱えず文字化けするため使わない。
   表紙は自然な縦横比で描く（棚の行レイアウト）。画像の選択は棚と同じ優先順位
   （背表紙 → 表表紙 → 裏表紙 → 外部表紙）で、背表紙・裏表紙だけの本も共有に画像が出る。 */
import { apiImageObjectUrl } from "./api.js";
import { spineColor, spineSrc, spineTextColor } from "./utils.js";

/* JST の日時スタンプ（ファイル名用） */
function jstStamp() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}`;
}
function safeFileName(s) {
  return String(s || "本棚").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-").slice(0, 40) || "本棚";
}

/* 画像URLを Blob URL に変換して読み込む（失敗時は null）。timeout 付き */
async function loadImageBlobUrl(url, timeoutMs = 6000) {
  if (!url) return null;
  try {
    const res = await Promise.race([
      fetch(url, { mode: "cors" }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return URL.createObjectURL(blob);
  } catch (_) {
    return null;
  }
}

/* アイテムの表紙画像を HTMLImageElement として読み込む。失敗時は null。
   画像の選択は棚と同じ優先順位（spineSrc：背表紙 → 表表紙 → 裏表紙 → 外部表紙）。
   返すのは { img, objectUrl, owned, ratio }。owned は自分で作った blob URL かどうか
   （apiImageObjectUrl の URL はアプリ全体でキャッシュ共有しているため revoke しない） */
async function loadCoverImage(item) {
  const src = spineSrc(item);
  if (!src) return null;
  let objectUrl = null;
  let owned = false;
  try {
    if (src.startsWith("/api/images/")) {
      objectUrl = await apiImageObjectUrl(decodeURIComponent(src.slice("/api/images/".length)));
    } else {
      objectUrl = await loadImageBlobUrl(src);
      owned = !!objectUrl;
    }
    if (!objectUrl) return null;
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("load failed"));
      setTimeout(() => reject(new Error("timeout")), 8000);
      im.src = objectUrl;
    });
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    return { img, objectUrl, owned, ratio: iw / ih };
  } catch (_) {
    if (objectUrl && owned) URL.revokeObjectURL(objectUrl);
    return null;
  }
}

/* 複数アイテムの表紙を並行して読み込む。結果は items と同じ順序・長さ（失敗時は null） */
async function loadCovers(items) {
  return Promise.all(items.map((item) => loadCoverImage(item)));
}
/* 決まった数ずつに分けて読み込む（500件の一括読み込みで同時接続が膨らまないようにする） */
async function loadCoversBatched(items, batchSize = 24) {
  const out = new Array(items.length).fill(null);
  for (let s = 0; s < items.length; s += batchSize) {
    const batch = items.slice(s, s + batchSize);
    const res = await Promise.all(batch.map((it) => loadCoverImage(it)));
    res.forEach((r, j) => { out[s + j] = r; });
  }
  return out;
}
/* 自分で作った blob URL だけを破棄する（apiImageObjectUrl のキャッシュは共有物のため残す） */
function revokeCovers(covers) {
  for (const c of covers) if (c && c.owned && c.objectUrl) URL.revokeObjectURL(c.objectUrl);
}

/* テキストを指定幅で折り返す（Canvas 用。日本語は1文字ずつ送る） */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const ch of String(text || "")) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* 画像を枠いっぱいに切り抜いて描く（cover-fit） */
function drawCoverFit(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/* 代替タイル：背表紙色＋タイトル頭文字 */
function drawTitleTile(ctx, item, x, y, w, h) {
  ctx.fillStyle = spineColor(item);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = spineTextColor(item);
  ctx.font = `700 ${Math.max(10, Math.round(Math.min(w, h) * 0.42))}px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((item.title || "?").slice(0, 1), x + w / 2, y + h / 2 + Math.min(w, h) * 0.04);
}

/* 表紙セルを描く（自然な縦横比の矩形。取得失敗時は色タイル）。タイトルは描かない */
function drawCoverCellNatural(ctx, item, loaded, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (loaded) drawCoverFit(ctx, loaded.img, x, y, w, h);
  else drawTitleTile(ctx, item, x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = "rgba(45,26,8,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

/* セルのタイトルを中央揃えで描く（最大 maxLines 行、はみ出す分は省略） */
function drawCellTitle(ctx, title, cx, topY, maxWidth, fontPx, lineHeight, maxLines = 2) {
  const text = String(title || "").trim();
  if (!text) return;
  ctx.save();
  ctx.font = `600 ${fontPx}px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#2d1a08";
  const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, i) => ctx.fillText(line, cx, topY + i * lineHeight));
  ctx.restore();
}

/* ---------- 棚の行レイアウト ----------
   行の高さを固定し、各冊の幅＝行高×自然比率として横に並べ、幅が足りなくなったら次の行へ折り返す。
   セルの幅は表紙幅と minCellW の大きい方（タイトルが読める最低幅を確保し、表紙はセル内で中央寄せ）。
   ratios: 各アイテムの幅／高さ比（画像がない場合は 0.707 の本型）。
   返すのは { rows: [{ cells: [{ index, ratio, coverW, cellW, x }], width }], consumed }。
   consumed は実際に配置できたアイテム数（maxRows を超えた分は含まない）。 */
function layoutShelfRows(ratios, { areaWidth, coverH, minCellW, maxCoverW, gapX, maxRows }) {
  const rows = [];
  let row = [];
  let rowW = 0;
  const cellFor = (ratio) => {
    const coverW = Math.max(28, Math.min(maxCoverW, Math.round(coverH * ratio)));
    return { coverW, cellW: Math.max(minCellW, coverW) };
  };
  for (let i = 0; i < ratios.length; i++) {
    const { coverW, cellW } = cellFor(ratios[i]);
    if (row.length > 0 && rowW + gapX + cellW > areaWidth) {
      rows.push({ cells: row, width: rowW });
      if (rows.length >= maxRows) break;
      row = [];
      rowW = 0;
    }
    row.push({ index: i, ratio: ratios[i], coverW, cellW, x: 0 });
    rowW = row.length === 1 ? cellW : rowW + gapX + cellW;
  }
  if (row.length && rows.length < maxRows) rows.push({ cells: row, width: rowW });
  for (const r of rows) {
    let x = 0;
    for (const c of r.cells) { c.x = x; x += c.cellW + gapX; }
  }
  const consumed = rows.reduce((n, r) => n + r.cells.length, 0);
  return { rows, consumed };
}

/* 棚の行を1行描く（表紙＋タイトル）。行は横方向に中央寄せする */
function drawShelfRow(ctx, row, items, covers, y, { areaX, areaWidth, coverH, titleFont, titleLH, titleGap }) {
  const offsetX = areaX + Math.round((areaWidth - row.width) / 2);
  for (const cell of row.cells) {
    const x = offsetX + cell.x;
    const coverX = x + (cell.cellW - cell.coverW) / 2;
    drawCoverCellNatural(ctx, items[cell.index], covers[cell.index], coverX, y, cell.coverW, coverH);
    drawCellTitle(ctx, items[cell.index].title, x + cell.cellW / 2, y + coverH + titleGap, cell.cellW, titleFont, titleLH, 2);
  }
}

/* 共有カード用のレイアウト定数（行高168 = 表紙110＋間隔6＋タイトル22px×2行（行間26＝52））。
   グリッド 284-992：4行で 4*168 + 3*12 = 708。フッター1032。すべて1080以内に収まる */
const CARD_LAYOUT = {
  areaX: 56, areaWidth: 968, coverH: 110, minCellW: 96, maxCoverW: 240,
  gapX: 12, rowGap: 12, maxRows: 4, titleFont: 22, titleLH: 26, titleGap: 6,
};
const CARD_ROW_H = CARD_LAYOUT.coverH + CARD_LAYOUT.titleGap + CARD_LAYOUT.titleLH * 2;
const CARD_GRID_TOP = 284;

/* PDFグリッドページ用のレイアウト定数（行高274 = 表紙208＋間隔8＋タイトル24px×2行（行間29＝58））。
   グリッド 164-1622：5行で 5*274 + 4*22 = 1458。フッター1690。すべて1754以内に収まる */
const PDF_LAYOUT = {
  areaX: 70, areaWidth: 1100, coverH: 208, minCellW: 120, maxCoverW: 320,
  gapX: 15, rowGap: 22, maxRows: 5, titleFont: 24, titleLH: 29, titleGap: 8,
};
const PDF_ROW_H = PDF_LAYOUT.coverH + PDF_LAYOUT.titleGap + PDF_LAYOUT.titleLH * 2;
const PDF_GRID_TOP = 164;

/* 共有カード（1080×1080）を描く。表紙は自然な縦横比で棚の行に並べる（最大20件）。
   高さの予算（すべて固定値で、フォルダ名の行数に依存しないためはみ出さない）：
     ブランド帯 0-10 / ブランド見出し baseline 84
     フォルダ名 52px・行間62 baseline 148・212（1行のときは中央の179）
     冊数 baseline 258 / グリッド 284-992（708）/ フッター baseline 1032 */
export async function renderShareCard({ title, subtitle, items }) {
  const W = 1080;
  const H = 1080;
  const M = 56;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const list = (items || []).slice(0, 20);

  /* 背景 */
  ctx.fillStyle = "#fdf6ee";
  ctx.fillRect(0, 0, W, H);
  /* 上部ブランド帯 */
  ctx.fillStyle = "#b8620a";
  ctx.fillRect(0, 0, W, 10);

  /* ブランド見出し（1行。「私の本棚」と「Bookshelf」の間は28pxの固定ギャップ） */
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#2d1a08";
  ctx.font = `700 32px "Noto Sans JP", sans-serif`;
  const brand = "私の本棚";
  ctx.fillText(brand, M, 84);
  const brandW = ctx.measureText(brand).width;
  ctx.fillStyle = "#7a5a3a";
  ctx.font = `400 26px "Noto Sans JP", sans-serif`;
  ctx.fillText("Bookshelf", M + brandW + 28, 84);

  /* フォルダ名（最大2行。1行のときは2行分の中央に置く） */
  ctx.fillStyle = "#2d1a08";
  ctx.font = `700 52px "Noto Sans JP", sans-serif`;
  const nameLines = wrapText(ctx, title || "本棚", W - M * 2).slice(0, 2);
  if (nameLines.length <= 1) {
    ctx.fillText(nameLines[0] || "本棚", M, 179);
  } else {
    nameLines.forEach((line, i) => ctx.fillText(line, M, 148 + i * 62));
  }

  /* 冊数（固定位置） */
  ctx.fillStyle = "#7a5a3a";
  ctx.font = `500 30px "Noto Sans JP", sans-serif`;
  ctx.fillText(subtitle || "", M, 258);

  /* 表紙の棚（自然な縦横比で横に並べる。4行まで） */
  const covers = await loadCovers(list);
  const ratios = covers.map((c) => (c ? c.ratio : 0.707));
  const { rows } = layoutShelfRows(ratios, CARD_LAYOUT);
  rows.forEach((row, r) => {
    drawShelfRow(ctx, row, list, covers, CARD_GRID_TOP + r * (CARD_ROW_H + CARD_LAYOUT.rowGap), CARD_LAYOUT);
  });
  revokeCovers(covers);

  /* フッター（Canvas内に描く） */
  ctx.fillStyle = "#7a5a3a";
  ctx.font = `400 26px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("私の本棚 — Bookshelf", W / 2, 1032);
  return canvas;
}

function canvasToBlob(canvas, type = "image/png") {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("画像の生成に失敗しました"))), type, 0.92);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* 共有カード画像（PNG）をダウンロードする */
export async function downloadSharePng({ title, subtitle, items }) {
  const canvas = await renderShareCard({ title, subtitle, items });
  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, `bookshelf-${safeFileName(title)}-${jstStamp()}.png`);
  return true;
}

/* 共有カード画像（PNG）を Web Share で共有する。使えなければダウンロードに切り替える */
export async function sharePng({ title, subtitle, items, text, url }) {
  const canvas = await renderShareCard({ title, subtitle, items });
  const blob = await canvasToBlob(canvas);
  const filename = `bookshelf-${safeFileName(title)}-${jstStamp()}.png`;
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title || "私の本棚", text: text || "", url: url || undefined });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
      /* 共有に失敗した場合はダウンロードに切り替える */
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

/* グリッドページ（A4比率 1240×1754）を描く。表紙＋タイトルのみ（作者・出版社・価格は出さない）。
   表紙は自然な縦横比で棚の行に並べる。pageRows は layoutShelfRows で作った行（5行まで）。
   高さの予算：
     ブランド帯 0-10 / ヘッダー baseline 104 / 区切り線 134
     グリッド 164-1622（1458）/ フッター baseline 1690 */
async function renderGridPage({ title, page, pageCount, pageItems, pageCovers, pageRows }) {
  const W = 1240;
  const H = 1754;
  const M = 70;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fdf6ee";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#b8620a";
  ctx.fillRect(0, 0, W, 10);

  /* ヘッダー：フォルダ名（1行）＋ページ番号 */
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#2d1a08";
  ctx.font = `700 48px "Noto Sans JP", sans-serif`;
  const name = wrapText(ctx, title || "本棚", W - M * 2 - 160).slice(0, 1)[0] || "";
  ctx.fillText(name, M, 104);
  ctx.fillStyle = "#7a5a3a";
  ctx.font = `400 28px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(`${page} / ${pageCount}`, W - M, 104);
  ctx.textAlign = "left";
  ctx.strokeStyle = "rgba(45,26,8,0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, 134);
  ctx.lineTo(W - M, 134);
  ctx.stroke();

  /* 表紙の棚（自然な縦横比で横に並べる） */
  pageRows.forEach((row, r) => {
    drawShelfRow(ctx, row, pageItems, pageCovers, PDF_GRID_TOP + r * (PDF_ROW_H + PDF_LAYOUT.rowGap), PDF_LAYOUT);
  });

  /* フッター（Canvas内に描く） */
  ctx.fillStyle = "#7a5a3a";
  ctx.font = `400 24px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("私の本棚 — Bookshelf", W / 2, 1690);
  return canvas;
}

/* 比率だけからページ分けを決める。ratios の先頭から5行分ずつ取り、ページごとの { start, count } を返す。
   描画パスでも同じ比率を使うため、計測と描画でページ分けがずれない */
function paginateByRows(ratios, layout) {
  const pages = [];
  let start = 0;
  while (start < ratios.length) {
    const { consumed } = layoutShelfRows(ratios.slice(start), layout);
    const take = Math.max(1, consumed);
    pages.push({ start, count: take });
    start += take;
  }
  return pages;
}

/* 共有PDFをダウンロードする。1ページ目に共有カード、続くページに表紙＋タイトルのグリッド（最大500件）。
   日本語テキストはすべてCanvas内に描く（jsPDF の doc.text は日本語を扱えず文字化けするため使わない）。
   ページ分けは比率の計測パスで先に確定させ、描画パスでは同じ比率でレイアウトする（ページ数の表示がずれない）。 */
export async function downloadSharePdf({ title, subtitle, items }) {
  const list = (items || []).slice(0, 500);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const card = await renderShareCard({ title, subtitle, items: list });
  const cardUrl = card.toDataURL("image/png");
  doc.addImage(cardUrl, "PNG", 0, 0, 210, 210);
  /* 計測パス：全アイテムの比率だけを先に読む（画像は保持しない。ページ数を確定させるため） */
  const allCovers = await loadCoversBatched(list, 24);
  const allRatios = allCovers.map((c) => (c ? c.ratio : 0.707));
  revokeCovers(allCovers);
  const pages = paginateByRows(allRatios, PDF_LAYOUT);
  const pageCount = pages.length;
  for (let p = 0; p < pages.length; p++) {
    const pageItems = list.slice(pages[p].start, pages[p].start + pages[p].count);
    const pageRatios = allRatios.slice(pages[p].start, pages[p].start + pages[p].count);
    const pageCovers = await loadCovers(pageItems);
    const { rows } = layoutShelfRows(pageRatios, PDF_LAYOUT);
    doc.addPage();
    const pageCanvas = await renderGridPage({ title, page: p + 1, pageCount, pageItems, pageCovers, pageRows: rows });
    const url = pageCanvas.toDataURL("image/png");
    doc.addImage(url, "PNG", 0, 0, 210, 297);
    revokeCovers(pageCovers);
  }
  doc.save(`bookshelf-${safeFileName(title)}-${jstStamp()}.pdf`);
  return true;
}
