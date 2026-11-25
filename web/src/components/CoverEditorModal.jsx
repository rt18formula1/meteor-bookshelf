import React, { useCallback, useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../api.js";
import { useApp } from "../store.jsx";

/* ホモグラフィ（4点対応）: src の4点を dst の4点へ写す H を解く */
function computeH(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
  }
  const n = 8;
  for (let col = 0, row = 0; col < n && row < n; col++, row++) {
    let piv = row;
    for (let r = row; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[row], A[piv]] = [A[piv], A[row]];
    [b[row], b[piv]] = [b[piv], b[row]];
    const d = A[row][col] || 1e-12;
    for (let j = col; j < n; j++) A[row][j] /= d;
    b[row] /= d;
    for (let r = 0; r < n; r++) {
      if (r === row) continue;
      const f = A[r][col];
      for (let j = col; j < n; j++) A[r][j] -= f * A[row][j];
      b[r] -= f * b[row];
    }
  }
  return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], 1];
}
function applyH(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}
function drawTriAffine(ctx, img, s0, s1, s2, d0, d1, d2) {
  const denom = (s1.y - s2.y) * (s0.x - s2.x) + (s2.x - s1.x) * (s0.y - s2.y);
  if (Math.abs(denom) < 1e-9) return;
  const a = ((s1.y - s2.y) * (d0.x - d2.x) + (s2.x - s1.x) * (d0.y - d2.y)) / denom;
  const b = ((s2.y - s0.y) * (d0.x - d2.x) + (s0.x - s2.x) * (d0.y - d2.y)) / denom;
  const c = d2.x - a * s2.x - b * s2.y;
  const d = ((s1.y - s2.y) * (d1.x - d2.x) + (s2.x - s1.x) * (d1.y - d2.y)) / denom;
  const e = ((s2.y - s0.y) * (d1.x - d2.x) + (s0.x - s2.x) * (d1.y - d2.y)) / denom;
  const f = d2.y - d * s2.x - e * s2.y;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y); ctx.lineTo(d1.x, d1.y); ctx.lineTo(d2.x, d2.y);
  ctx.closePath(); ctx.clip();
  ctx.setTransform(a, d, b, e, c, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

const MAX_SRC_EDGE = 3000; // 作業用キャンバスの長辺上限
const MAX_OUT_EDGE = 2000; // 補正後画像の長辺上限（従来は 600x848 固定で粗くなっていた）
const WARP_GRID = 56; // 三角形分割の細かさ（従来 24 で継ぎ目が目立った）

/* 写真ファイルの EXIF 向きを画素に焼き込んだ作業用キャンバスを作る。
   <img> の naturalWidth/Height はブラウザ（特に iOS Safari）で EXIF 回転と
   ずれることがあり、座標計算が狂って向きがバグるため、createImageBitmap の
   imageOrientation: 'from-image' で正規化してから扱う。 */
async function fileToCanvas(file) {
  let bmp = null;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch (_) {
    try { bmp = await createImageBitmap(file); } catch (_) { bmp = null; }
  }
  let w, h, drawable;
  if (bmp) {
    w = bmp.width; h = bmp.height; drawable = bmp;
  } else {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      w = img.naturalWidth; h = img.naturalHeight; drawable = img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }
  const scale = Math.min(1, MAX_SRC_EDGE / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(drawable, 0, 0, cw, ch);
  if (bmp && bmp.close) bmp.close();
  return c;
}

function canvasToBlob(canvas, type = "image/jpeg", q = 0.92) {
  return new Promise((r) => canvas.toBlob(r, type, q));
}

export default function CoverEditorModal() {
  const { coverEditor, closeCoverEditor, toast } = useApp();
  const [imgUrl, setImgUrl] = useState("");
  const [corners, setCorners] = useState(null); // 表示座標（px）
  const [busy, setBusy] = useState(false);
  const imgRef = useRef(null);
  const editorRef = useRef(null);
  const dragIdx = useRef(null);
  const srcRef = useRef(null); // 作業用キャンバス（EXIF 正規化済み）

  const file = coverEditor && coverEditor.file;
  const label = (coverEditor && coverEditor.label) || "表紙";

  useEffect(() => {
    if (!file) return;
    let url = "";
    let cancelled = false;
    setCorners(null);
    setImgUrl("");
    (async () => {
      try {
        const canvas = await fileToCanvas(file);
        if (cancelled) return;
        srcRef.current = canvas;
        const blob = await canvasToBlob(canvas);
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        setImgUrl(url);
      } catch (_) {
        if (!cancelled) toast("画像の読み込みに失敗しました");
      }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const handleImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.clientWidth, h = img.clientHeight;
    setCorners([
      { x: w * 0.08, y: h * 0.08 },
      { x: w * 0.92, y: h * 0.08 },
      { x: w * 0.92, y: h * 0.92 },
      { x: w * 0.08, y: h * 0.92 },
    ]);
  };

  const moveCorner = useCallback((clientX, clientY) => {
    if (dragIdx.current == null || !editorRef.current) return;
    const rect = editorRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    setCorners((cs) => (cs ? cs.map((c, i) => (i === dragIdx.current ? { x, y } : c)) : cs));
  }, []);

  if (!coverEditor) return null;

  const uploadBlob = async (blob, name) => {
    const fd = new FormData();
    fd.append("file", blob, name);
    const res = await api("/api/images", { method: "POST", body: fd });
    const cb = coverEditor.onDone;
    closeCoverEditor();
    toast(`${label}写真を保存しました`);
    if (cb) cb(res.key);
  };

  /* 補正せずそのまま使う（向きだけは正規化された状態で保存される） */
  const useAsIs = async () => {
    const src = srcRef.current;
    if (!src || busy) return;
    setBusy(true);
    try {
      const blob = await canvasToBlob(src);
      if (!blob) throw new Error("画像の変換に失敗しました");
      await uploadBlob(blob, "photo.jpg");
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    const img = imgRef.current;
    const src = srcRef.current;
    if (!img || !src || !corners || busy) return;
    setBusy(true);
    try {
      const scaleX = src.width / img.clientWidth;
      const scaleY = src.height / img.clientHeight;
      const quad = corners.map((c) => ({ x: c.x * scaleX, y: c.y * scaleY }));
      const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
      /* 出力サイズは四隅で囲んだ実物の大きさに合わせる（固定サイズにしない） */
      let outW = Math.round((dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2);
      let outH = Math.round((dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2);
      const os = Math.min(1, MAX_OUT_EDGE / Math.max(outW, outH));
      outW = Math.max(2, Math.round(outW * os));
      outH = Math.max(2, Math.round(outH * os));
      const H = computeH(
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
        quad
      );
      const out = document.createElement("canvas");
      out.width = outW; out.height = outH;
      const ctx = out.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const GRID = WARP_GRID;
      for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
          const u0 = gx / GRID, v0 = gy / GRID, u1 = (gx + 1) / GRID, v1 = (gy + 1) / GRID;
          const p00 = applyH(H, u0, v0), p10 = applyH(H, u1, v0), p01 = applyH(H, u0, v1), p11 = applyH(H, u1, v1);
          drawTriAffine(ctx, src, p00, p10, p01, { x: u0 * outW, y: v0 * outH }, { x: u1 * outW, y: v0 * outH }, { x: u0 * outW, y: v1 * outH });
          drawTriAffine(ctx, src, p10, p11, p01, { x: u1 * outW, y: v0 * outH }, { x: u1 * outW, y: v1 * outH }, { x: u0 * outW, y: v1 * outH });
        }
      }
      const blob = await canvasToBlob(out);
      if (!blob) throw new Error("画像の変換に失敗しました");
      await uploadBlob(blob, "photo.jpg");
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const editorW = imgRef.current ? imgRef.current.clientWidth : 0;
  const editorH = imgRef.current ? imgRef.current.clientHeight : 0;

  return (
    <Modal onClose={closeCoverEditor}>
      <h2 id="cover-modal-title">{label}の切り抜き（台形補正）</h2>
      <p className="muted small">{label}の四隅に丸ハンドルを合わせてください。斜めに写った写真をまっすぐに補正して切り抜きます。</p>
      <div className="cover-editor" ref={editorRef}>
        {imgUrl && <img ref={imgRef} src={imgUrl} alt={`${label}写真`} onLoad={handleImgLoad} draggable={false} />}
        {corners && (
          <>
            <svg viewBox={`0 0 ${editorW} ${editorH}`} preserveAspectRatio="none">
              <polygon points={corners.map((c) => `${c.x},${c.y}`).join(" ")} />
            </svg>
            {corners.map((c, i) => (
              <div
                key={i}
                className="corner-handle"
                style={{ left: c.x, top: c.y }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  dragIdx.current = i;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (dragIdx.current === i) moveCorner(e.clientX, e.clientY);
                }}
                onPointerUp={() => { dragIdx.current = null; }}
                onPointerCancel={() => { dragIdx.current = null; }}
              />
            ))}
          </>
        )}
      </div>
      <div className="row-gap">
        <button className="btn-primary" onClick={apply} disabled={busy || !corners}>
          {busy ? "処理中…" : "補正して使う"}
        </button>
        <button className="btn-secondary" onClick={useAsIs} disabled={busy || !imgUrl}>
          補正せずそのまま使う
        </button>
        <button className="btn-secondary" onClick={closeCoverEditor}>キャンセル</button>
      </div>
    </Modal>
  );
}
