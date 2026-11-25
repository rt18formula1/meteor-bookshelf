import React, { useState } from "react";
import { progressPct, spineColor, spineSize, spineSrc, spineTextColor } from "../utils.js";
import AuthedImage from "./AuthedImage.jsx";

export default function Spine({ item, selected, onSelect }) {
  const { width, height } = spineSize(item);
  const src = spineSrc(item);
  const [imgFailed, setImgFailed] = useState(false);
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
