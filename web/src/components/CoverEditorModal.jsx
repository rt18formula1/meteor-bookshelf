import React, { useCallback, useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../api.js";
import { useApp } from "../store.jsx";

/* ホモグラフィ（4点対応）: src の4点を dst の4点へ写す H を解く（旧実装から移植） */
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

export default function CoverEditorModal() {
  const { coverEditor, closeCoverEditor, toast } = useApp();
  const [imgUrl, setImgUrl] = useState("");
  const [corners, setCorners] = useState(null); // 表示座標（px）
  const [busy, setBusy] = useState(false);
  const imgRef = useRef(null);
  const editorRef = useRef(null);
  const dragIdx = useRef(null);

  const file = coverEditor && coverEditor.file;

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setCorners(null);
    return () => URL.revokeObjectURL(url);
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

  const apply = async () => {
    const img = imgRef.current;
    if (!img || !corners || busy) return;
    setBusy(true);
    try {
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;
      const quad = corners.map((c) => ({ x: c.x * scaleX, y: c.y * scaleY }));
      const OUT_W = 600, OUT_H = 848;
      const H = computeH(
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
        quad
      );
      const src = document.createElement("canvas");
      src.width = img.naturalWidth; src.height = img.naturalHeight;
      src.getContext("2d").drawImage(img, 0, 0);
      const out = document.createElement("canvas");
      out.width = OUT_W; out.height = OUT_H;
      const ctx = out.getContext("2d");
      const GRID = 24;
      for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
          const u0 = gx / GRID, v0 = gy / GRID, u1 = (gx + 1) / GRID, v1 = (gy + 1) / GRID;
          const p00 = applyH(H, u0, v0), p10 = applyH(H, u1, v0), p01 = applyH(H, u0, v1), p11 = applyH(H, u1, v1);
          drawTriAffine(ctx, src, p00, p10, p01, { x: u0 * OUT_W, y: v0 * OUT_H }, { x: u1 * OUT_W, y: v0 * OUT_H }, { x: u0 * OUT_W, y: v1 * OUT_H });
          drawTriAffine(ctx, src, p10, p11, p01, { x: u1 * OUT_W, y: v0 * OUT_H }, { x: u1 * OUT_W, y: v1 * OUT_H }, { x: u0 * OUT_W, y: v1 * OUT_H });
        }
      }
      const blob = await new Promise((r) => out.toBlob(r, "image/jpeg", 0.88));
      const fd = new FormData();
      fd.append("file", blob, "cover.jpg");
      const res = await api("/api/images", { method: "POST", body: fd });
      const cb = coverEditor.onDone;
      closeCoverEditor();
      toast("表紙写真を保存しました");
      if (cb) cb(res.key);
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
      <h2 id="cover-modal-title">表紙の切り抜き（台形補正）</h2>
      <p className="muted small">表紙の四隅に丸ハンドルを合わせてください。斜めに写った表紙をまっすぐに補正して切り抜きます。</p>
      <div className="cover-editor" ref={editorRef}>
        {imgUrl && <img ref={imgRef} src={imgUrl} alt="表紙写真" onLoad={handleImgLoad} draggable={false} />}
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
        <button className="btn-secondary" onClick={closeCoverEditor}>キャンセル</button>
      </div>
    </Modal>
  );
}
