/* 共有カード（PNG）と共有PDFの生成。すべてクライアント側で行う。
   日本語は Canvas に描画して画像化するため、フォントの問題が出ない。
   表紙画像は取得できない場合があるため、取得失敗時は色タイル＋頭文字で代替表示する
   （Canvas が汚染されると toBlob が使えなくなるため、取得失敗した画像は描画しない）。 */
import { apiImageObjectUrl } from "./api.js";
import { spineColor, spineTextColor, fmtPrice } from "./utils.js";

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

/* 共有カード（1080×1080）を描く。items は最大9枚まで表紙グリッドに使う */
export async function renderShareCard({ title, subtitle, items }) {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const list = (items || []).slice(0, 9);

  /* 背景 */
  ctx.fillStyle = "#fdf6ee";
  ctx.fillRect(0, 0, W, H);
  /* 上部ブランド帯 */
  ctx.fillStyle = "#b8620a";
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = "#2d1a08";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 34px "Noto Sans JP", sans-serif`;
  ctx.fillText("私の本棚", 64, 92);
  ctx.fillStyle = "#7a5a3a";
  ctx.font = `400 28px "Noto Sans JP", sans-serif`;
  ctx.fillText("Bookshelf", 64 + ctx.measureText("私の本棚").width + 18, 92);

  /* フォルダ名（最大2行） */
  ctx.fillStyle = "#2d1a08";
  ctx.font = `700 64px "Noto Sans JP", sans-serif`;
  const nameLines = wrapText(ctx, title || "本棚", W - 128).slice(0, 2);
  nameLines.forEach((line, i) => ctx.fillText(line, 64, 190 + i * 78));

  /* 冊数 */
  const subY = 190 + nameLines.length * 78 + 8;
  ctx.fillStyle = "#7a5a3a";
  ctx.font = `500 36px "Noto Sans JP", sans-serif`;
  ctx.fillText(subtitle || "", 64, subY);

  /* 表紙グリッド（3×3） */
  const gridTop = subY + 48;
  const gap = 16;
  const cell = Math.floor((W - 128 - gap * 2) / 3);
  const gridH = cell * 3 + gap * 2;
  const covers = [];
  for (const item of list) {
    covers.push(await loadCoverImage(item));
  }
  for (let i = 0; i < 9; i++) {
    const r = Math.floor(i / 3);
    const c = i % 3;
    const x = 64 + c * (cell + gap);
    const y = gridTop + r * (cell + gap);
    const item = list[i];
    const loaded = covers[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cell, cell);
    ctx.clip();
    if (item && loaded) drawCoverFit(ctx, loaded.img, x, y, cell, cell);
    else if (item) drawTitleTile(ctx, item, x, y, cell, cell);
    else {
      ctx.fillStyle = "#f5eee6";
      ctx.fillRect(x, y, cell, cell);
    }
    ctx.restore();
    /* 枠線 */
    ctx.strokeStyle = "rgba(45,26,8,0.12)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cell, cell);
  }
  for (const c of covers) {
    if (c && c.objectUrl) URL.revokeObjectURL(c.objectUrl);
  }

  /* フッター */
  ctx.fillStyle = "#7a5a3a";
  ctx.font = `400 26px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("私の本棚 — Bookshelf", W / 2, gridTop + gridH + 56);
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

/* 一覧ページ（A4比率 1240×1754）を描く。rows は1ページ分のアイテム */
function renderListPage({ title, page, pageCount, rows }) {
  const W = 1240;
  const H = 1754;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fdf6ee";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#b8620a";
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = "#2d1a08";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 52px "Noto Sans JP", sans-serif`;
  const nameLines = wrapText(ctx, title || "本棚", W - 140).slice(0, 1);
  ctx.fillText(nameLines[0] || "", 70, 110);
  ctx.fillStyle = "#7a5a3a";
  ctx.font = `400 30px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(`${page} / ${pageCount}`, W - 70, 110);
  ctx.textAlign = "left";
  ctx.strokeStyle = "rgba(45,26,8,0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(70, 140);
  ctx.lineTo(W - 70, 140);
  ctx.stroke();

  let y = 200;
  const rowH = 96;
  for (const item of rows) {
    ctx.fillStyle = "#2d1a08";
    ctx.font = `600 34px "Noto Sans JP", sans-serif`;
    const t = wrapText(ctx, item.title || "", W - 140).slice(0, 1)[0] || "";
    ctx.fillText(t, 70, y + 38);
    const sub = [item.creator, item.publisher, fmtPrice(item.price)].filter(Boolean).join(" ／ ");
    ctx.fillStyle = "#7a5a3a";
    ctx.font = `400 28px "Noto Sans JP", sans-serif`;
    ctx.fillText(sub.slice(0, 60), 70, y + 78);
    ctx.strokeStyle = "rgba(45,26,8,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(70, y + rowH - 8);
    ctx.lineTo(W - 70, y + rowH - 8);
    ctx.stroke();
    y += rowH;
  }
  ctx.fillStyle = "#7a5a3a";
  ctx.font = `400 24px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("私の本棚 — Bookshelf", W / 2, H - 40);
  return canvas;
}

/* 共有PDFをダウンロードする。1ページ目に共有カード、続くページにアイテム一覧（最大500件） */
export async function downloadSharePdf({ title, subtitle, items }) {
  const list = (items || []).slice(0, 500);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const card = await renderShareCard({ title, subtitle, items: list });
  const cardUrl = card.toDataURL("image/png");
  doc.addImage(cardUrl, "PNG", 0, 0, 210, 210);
  doc.setFontSize(11);
  doc.text("私の本棚 — Bookshelf", 105, 222, { align: "center" });
  const perPage = 15;
  const pageCount = Math.max(1, Math.ceil(list.length / perPage));
  for (let p = 0; p < pageCount; p++) {
    doc.addPage();
    const rows = list.slice(p * perPage, (p + 1) * perPage);
    const pageCanvas = renderListPage({ title, page: p + 1, pageCount, rows });
    const url = pageCanvas.toDataURL("image/png");
    doc.addImage(url, "PNG", 0, 0, 210, 297);
  }
  doc.save(`bookshelf-${safeFileName(title)}-${jstStamp()}.pdf`);
  return true;
}
