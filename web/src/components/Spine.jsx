import React, { useEffect, useState } from "react";
import { progressPct, spineColor, spineSize, spineSrc, spineTextColor } from "../utils.js";
import { loadImageSize } from "../api.js";
import AuthedImage from "./AuthedImage.jsx";

export default function Spine({ item, selected, onSelect }) {
  const base = spineSize(item);
  const src = spineSrc(item);
  const [imgFailed, setImgFailed] = useState(false);
  /* 比率は背表紙（spine_key）が登録されている場合にだけ読み、読み取る画像も背表紙のURLを直接指定する。
     背表紙未登録の場合は横幅は従来通り spineSize の幅（ハッシュによるランダムな幅）のまま。
     画像自体は従来通り spineSrc（背表紙 → 表表紙 → 裏表紙 → 外部表紙）で表示する。
     高さは常に spineSize から決める（背表紙の有無で変えない）。
     幅＝高さ×比率をそのまま使い、下限・上限のクランプはつけない。
     EP・シングルのさらに薄い背や薄い本の真の比率を出すため（0px になる退行だけ 1px で防ぐ）。
     画像がない・読めない場合は従来の固定サイズのまま */
  const spineUrl = item.spine_key ? `/api/images/${encodeURIComponent(item.spine_key)}` : "";
  const [spineRatio, setSpineRatio] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setSpineRatio(null);
    if (!spineUrl) return undefined;
    let timer = null;
    loadImageSize(spineUrl)
      .then((s) => {
        if (cancelled) return;
        if (s) { setSpineRatio(s.width / s.height); return; }
        // 読み取りに失敗したら800ms後に1回だけ再試行する
        timer = setTimeout(() => {
          loadImageSize(spineUrl)
            .then((s2) => { if (!cancelled && s2) setSpineRatio(s2.width / s2.height); })
            .catch(() => {});
        }, 800);
      })
      .catch(() => {});
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spineUrl]);
  /* フォールバック：実際に表示された背表紙の画像から比率を取る。
     別経路の読み取りが失敗しても、表示中の画像から確実に比率が付く。
     spine_key がある場合、表示画像は背表紙そのものなのでこの比率が正しい */
  const handleImgLoad = (e) => {
    if (!spineUrl) return;
    const im = e.target;
    if (im && im.naturalWidth && im.naturalHeight) {
      setSpineRatio(im.naturalWidth / im.naturalHeight);
    }
  };
  const width = spineRatio ? Math.max(1, Math.round(base.height * spineRatio)) : base.width;
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
        <AuthedImage className="spine-cover" src={src} alt="" loading="lazy" onError={() => setImgFailed(true)} onLoad={handleImgLoad} />
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
