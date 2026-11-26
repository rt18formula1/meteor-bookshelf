import React, { useState } from "react";
import { STATUS_LABEL, TYPE_BADGE, coverSrc, spineColor } from "../utils.js";
import { useApp } from "../store.jsx";
import AuthedImage from "./AuthedImage.jsx";

/* 1件分のカード行。クリックで詳細を開く。
   selectable の場合は左端にチェックボックスを出し、フォルダへの一括追加などで使う。
   チェックボックスの操作では詳細を開かず、トグルのみ行う。
   外側は <div role="button">（<button> の中にチェックボックスは置けないため。
   Enter／Space キーで詳細を開くキーボード操作は維持する） */
export default function ListRow({ item, selectable, checked, onToggle }) {
  const { openDetail } = useApp();
  const src = coverSrc(item);
  const [failed, setFailed] = useState(false);

  const handleKeyDown = (e) => {
    /* チェックボックスにフォーカスがある場合は行のキー操作をしない */
    if (e.target && e.target.tagName === "INPUT") return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail(item.id);
    }
  };

  return (
    <div
      className={`list-row${checked ? " list-row-selected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => openDetail(item.id)}
      onKeyDown={handleKeyDown}
    >
      {selectable && (
        <input
          type="checkbox"
          className="list-check"
          checked={!!checked}
          aria-label={`${item.title}を選択`}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); if (onToggle) onToggle(item.id, e.target.checked); }}
        />
      )}
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
    </div>
  );
}
