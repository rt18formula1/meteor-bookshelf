import React, { useEffect, useState } from "react";
import { apiImageObjectUrl } from "../api.js";

/* /api/images/ 配下の画像は Authorization 付き fetch で取得して表示する。
   それ以外の URL（外部の表紙 URL 等）はそのまま <img> で表示する */
export default function AuthedImage({ src, alt = "", className = "", loading, onError, onLoad, style }) {
  const isApiImage = typeof src === "string" && src.startsWith("/api/images/");
  const [objUrl, setObjUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!isApiImage) { setObjUrl(""); return; }
    const key = decodeURIComponent(src.slice("/api/images/".length));
    apiImageObjectUrl(key)
      .then((u) => { if (!cancelled) setObjUrl(u); })
      .catch(() => { if (!cancelled && onError) onError(); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (isApiImage) {
    if (!objUrl) return null;
    return <img className={className} src={objUrl} alt={alt} loading={loading} onError={onError} onLoad={onLoad} style={style} />;
  }
  return <img className={className} src={src} alt={alt} loading={loading} onError={onError} onLoad={onLoad} style={style} />;
}
