import React, { useEffect, useRef } from "react";
import { STATUS_LABEL, TYPE_BADGE, progressPct } from "../utils.js";
import { useApp } from "../store.jsx";
import { IconMemo } from "./Icons.jsx";

/* 選択中アイテムの詳細カード（参考イメージのカード様式） */
export default function PulloutPanel({ item }) {
  const { openDetail } = useApp();
  const ref = useRef(null);

  useEffect(() => {
    if (item && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [item && item.id]);

  if (!item) return null;
  const pct = progressPct(item);
  const unit = item.type === "book" ? "p." : "";

  return (
    <div className="pullout" ref={ref} key={item.id}>
      <div className="badge-row card-badges">
        <span className="badge badge-outline">{TYPE_BADGE[item.type] || "ITEM"}</span>
        <span className={`badge badge-status status-${item.status}`}>{STATUS_LABEL[item.status] || ""}</span>
        <span className="card-memo-count">
          <IconMemo size={16} /> メモ {item.memo_count || 0}件
        </span>
      </div>
      <h2 className="card-title">{item.title}</h2>
      <p className="card-creator">{item.creator || ""}</p>
      {item.prog_total > 0 && (
        <div className="card-progress">
          <div className="progress-track progress-track-dark">
            <div className="progress-bar" style={{ width: `${pct}%` }} />
          </div>
          <div className="card-progress-meta">
            <span className="progress-text">{unit}{item.prog_cur} / {item.prog_total}</span>
            <span className="card-pct">{pct}%</span>
          </div>
        </div>
      )}
      <div className="pullout-actions">
        <button className="btn-primary" onClick={() => openDetail(item.id)}>詳細を見る</button>
        <button className="btn-secondary" onClick={() => openDetail(item.id, true)}>メモを書く</button>
      </div>
    </div>
  );
}
