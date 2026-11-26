/* 共有カード（PNG）と共有PDFの生成。すべてクライアント側で行う。
   日本語は Canvas に描画して画像化するため、フォントの問題が出ない。
   表紙画像は取得できない場合があるため、取得失敗時は色タイル＋頭文字で代替表示する
   （Canvas が汚染されると toBlob が使えなくなるため、取得失敗した画像は描画しない）。
   PDF の文字はすべて Canvas 内に描く。jsPDF の doc.text は日本語を扱えず文字化けするため使わない。 */
import { apiImageObjectUrl } from "./api.js";
import { spineColor, spineTextColor } from "./utils.js";

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

/* アイテムの表紙画像を HTMLImageElement として読み込む。失敗時は null */
async function loadCoverImage(item) {
  let objectUrl = null;
  try {
    if (item.image_key) {
      objectUrl = await apiImageObjectUrl(item.image_key);
    } else if (item.cover_url) {
      objectUrl = await loadImageBlobUrl(item.cover_url);
    }
    if (!objectUrl) return null;
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("load failed"));
      setTimeout(() => reject(new Error("timeout")), 8000);
      im.src = objectUrl;
    });
    return { img, objectUrl };
  } catch (_) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    return null;
  }
}

/* 複数アイテムの表紙を並行して読み込む。結果は items と同じ順序・長さ（失敗時は null） */
async function loadCovers(items) {
  return Promise.all(items.map((item) => loadCoverImage(item)));
}
function revokeCovers(covers) {
  for (const c of covers) if (c && c.objectUrl) URL.revokeObjectURL(c.objectUrl);
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
  ctx.font = `700 ${Math.round(w * 0.42)}px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((item.title || "?").slice(0, 1), x + w / 2, y + h / 2 + w * 0.04);
}

/* 表紙セルを描く（正方形・cover-fit、取得失敗時は色タイル）。タイトルは描かない */
function drawCoverCell(ctx, item, loaded, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  if (loaded) drawCoverFit(ctx, loaded.img, x, y, size, size);
  else drawTitleTile(ctx, item, x, y, size, size);
  ctx.restore();
  ctx.strokeStyle = "rgba(45,26,8,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);
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

/* 共有カード（1080×1080）を描く。5列×4行＝最大20件。
   高さの予算（すべて固定値で、フォルダ名の行数に依存しないためはみ出さない）：
     ブランド帯 0-10 / ブランド見出し baseline 84
     フォルダ名 52px・行間62 baseline 148・212（1行のときは中央の179）
     冊数 baseline 258 / グリッド 284-992（708）/ フッター baseline 1032
   グリッド：余白56・間隔12、セル幅184 = (1080-56*2-12*4)/5
     行高168 = 表紙110＋間隔6＋タイトル22px×2行（行間26＝52）
     284 + 4*168 + 3*12 = 992。フッター1032。すべて1080以内に収まる。 */
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

  /* 表紙グリッド（5列×4行＝最大20件） */
  const COLS = 5;
  const GAP = 12;
  const CW = 184;
  const RH = 168;
  const CS = 110;
  const TITLE_FONT = 22;
  const TITLE_LH = 26;
  const TITLE_GAP = 6;
  const GRID_TOP = 284;
  const covers = await loadCovers(list);
  for (let i = 0; i < list.length; i++) {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const x = M + c * (CW + GAP);
    const y = GRID_TOP + r * (RH + GAP);
    const coverX = x + (CW - CS) / 2;
    drawCoverCell(ctx, list[i], covers[i], coverX, y, CS);
    drawCellTitle(ctx, list[i].title, x + CW / 2, y + CS + TITLE_GAP, CW, TITLE_FONT, TITLE_LH, 2);
  }
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
   5列×5行＝25件。ヘッダーにフォルダ名とページ番号、フッターはCanvas内に描く。
   高さの予算：
     ブランド帯 0-10 / ヘッダー baseline 104 / 区切り線 134
     グリッド 164-1622（1458）/ フッター baseline 1690
   グリッド：余白70・横間隔15、セル幅208 = (1240-70*2-15*4)/5、表紙208
     行高274 = 表紙208＋間隔8＋タイトル24px×2行（行間29＝58）、行間22
     164 + 5*274 + 4*22 = 1622。フッター1690。すべて1754以内に収まる。 */
async function renderGridPage({ title, page, pageCount, rows }) {
  const W = 1240;
  const H = 1754;
  const M = 70;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const list = rows || [];

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

  /* グリッド（5列×5行＝25件） */
  const COLS = 5;
  const GAP_X = 15;
  const GAP_Y = 22;
  const CW = 208;
  const CS = 208;
  const RH = 274;
  const TITLE_FONT = 24;
  const TITLE_LH = 29;
  const TITLE_GAP = 8;
  const GRID_TOP = 164;
  const covers = await loadCovers(list);
  for (let i = 0; i < list.length; i++) {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const x = M + c * (CW + GAP_X);
    const y = GRID_TOP + r * (RH + GAP_Y);
    drawCoverCell(ctx, list[i], covers[i], x, y, CS);
    drawCellTitle(ctx, list[i].title, x + CW / 2, y + CS + TITLE_GAP, CW, TITLE_FONT, TITLE_LH, 2);
  }
  revokeCovers(covers);

  /* フッター（Canvas内に描く） */
  ctx.fillStyle = "#7a5a3a";
  ctx.font = `400 24px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("私の本棚 — Bookshelf", W / 2, 1690);
  return canvas;
}

/* 共有PDFをダウンロードする。1ページ目に共有カード、続くページに表紙＋タイトルのグリッド（最大500件）。
   日本語テキストはすべてCanvas内に描く（jsPDF の doc.text は日本語を扱えず文字化けするため使わない）。 */
export async function downloadSharePdf({ title, subtitle, items }) {
  const list = (items || []).slice(0, 500);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const card = await renderShareCard({ title, subtitle, items: list });
  const cardUrl = card.toDataURL("image/png");
  doc.addImage(cardUrl, "PNG", 0, 0, 210, 210);
  const perPage = 25;
  const pageCount = Math.ceil(list.length / perPage);
  for (let p = 0; p < pageCount; p++) {
    doc.addPage();
    const rows = list.slice(p * perPage, (p + 1) * perPage);
    const pageCanvas = await renderGridPage({ title, page: p + 1, pageCount, rows });
    const url = pageCanvas.toDataURL("image/png");
    doc.addImage(url, "PNG", 0, 0, 210, 297);
  }
  doc.save(`bookshelf-${safeFileName(title)}-${jstStamp()}.pdf`);
  return true;
}
