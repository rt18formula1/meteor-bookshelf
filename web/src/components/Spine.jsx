import React, { useEffect, useState } from "react";
import { progressPct, spineColor, spineSize, spineSrc, spineTextColor } from "../utils.js";
import { loadImageSize } from "../api.js";
import AuthedImage from "./AuthedImage.jsx";

export default function Spine({ item, selected, onSelect }) {
  const base = spineSize(item);
  const src = spineSrc(item);
  const [imgFailed, setImgFailed] = useState(false);
  /* 棚に表示する画像（背表紙 → 表表紙 → 裏表紙 → 外部表紙）の自然な縦横比で幅を決める。
     高さは spineSize（判型・手動の高さ・CD上限を反映）の高さ、幅＝高さ×（画像幅／画像高さ）で 24〜96px に収める。
     寸法は表示時に画像から読み取るため、既存の蔵書の画像（新しく登録したもの以外）にも同じように適用される。
     画像がない・読めない場合は従来の固定サイズのまま */
  const [spineRatio, setSpineRatio] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setSpineRatio(null);
    if (!src) return undefined;
    loadImageSize(src)
      .then((s) => { if (!cancelled && s) setSpineRatio(s.width / s.height); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  const width = spineRatio
    ? Math.max(24, Math.min(96, Math.round(base.height * spineRatio)))
    : base.width;
  const height = base.height;
  const pct = progressPct(item);
  const color = spineColor(item);
  const showImg = src && !imgFailed;

  return (
    <div
      className={`spine${selected ? " pulled" : ""}`}
      style={{ width, height, background: color, color: spineTextColor(item) }}
      onClick={() => onSelect(item.id)}
      role="button"
      aria-label={item.title}
      title={item.title}
    >
      {showImg ? (
        <AuthedImage className="spine-cover" src={src} alt="" loading="lazy" onError={() => setImgFailed(true)} />
      ) : (
        <>
          <span className="spine-band spine-band-top" />
          <span className="spine-band spine-band-bottom" />
          <span className="spine-text">
            <span className="spine-title">{item.title}</span>
            <span className="spine-creator">{item.creator || ""}</span>
          </span>
        </>
      )}
      {item.prog_total > 0 && (
        <span className="spine-progress">
          <span className="spine-progress-fill" style={{ width: `${pct}%` }} />
        </span>
      )}
    </div>
  );
}
