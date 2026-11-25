import React, { useState } from "react";
import { STATUS_LABEL, TYPE_BADGE, coverSrc, spineColor } from "../utils.js";
import { useApp } from "../store.jsx";
import AuthedImage from "./AuthedImage.jsx";

export default function ListRow({ item }) {
  const { openDetail } = useApp();
  const src = coverSrc(item);
  const [failed, setFailed] = useState(false);

  return (
    <button className="list-row" onClick={() => openDetail(item.id)}>
      {src && !failed ? (
        <AuthedImage className="list-thumb" src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="list-thumb-gen" style={{ background: spineColor(item) }}>
          {(item.title || "").slice(0, 1)}
        </span>
      )}
      <span className="list-main">
        <span className="list-title">{item.title}</span>
        <span className="list-sub">{item.creator || ""}</span>
        {(item.type === "cd" || item.type === "dvd") && item.catno && (
          <span className="list-catno">品番 {item.catno}</span>
        )}
      </span>
      <span className="list-meta">
        <span className="badge">{TYPE_BADGE[item.type] || "ITEM"}</span>
        <span className="badge badge-muted">{STATUS_LABEL[item.status] || ""}</span>
        {item.prog_total > 0 && (
          <span className="badge badge-muted">{item.prog_cur}/{item.prog_total}</span>
        )}
        <span className="badge badge-muted">メモ {item.memo_count || 0}</span>
      </span>
    </button>
  );
}
