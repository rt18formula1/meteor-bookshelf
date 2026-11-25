import React, { useEffect, useState } from "react";
import { coverSrc, spineColor, spineTextColor } from "../utils.js";
import AuthedImage from "./AuthedImage.jsx";

/* 生成表紙: 背表紙色ベースのグラデーション＋額縁＋タイトル/著者 */
export function GenCover({ item, className = "" }) {
  const c = spineColor(item);
  const dark = spineTextColor(item) !== "#fff8f0";
  return (
    <div
      className={`cover-generated${dark ? " cg-dark" : ""} ${className}`}
      style={{ background: `linear-gradient(155deg, ${c} 0%, ${c}dd 55%, ${c}b8 100%)` }}
    >
      <div className="cg-frame">
        <div className="cg-title">{item.title}</div>
        <div className="cg-rule" />
        <div className="cg-creator">{item.creator || ""}</div>
        {item.publisher && <div className="cg-publisher">{item.publisher}</div>}
      </div>
    </div>
  );
}

/* 表表紙: 画像があれば画像、読み込み失敗時は生成表紙へフォールバック */
export default function Cover({ item, className = "" }) {
  const src = coverSrc(item);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <GenCover item={item} className={className} />;
  return <AuthedImage className={className} src={src} alt={item.title} loading="lazy" onError={() => setFailed(true)} />;
}
