import React, { useEffect, useRef } from "react";
import Cover from "./Cover.jsx";
import { STATUS_LABEL, TYPE_BADGE, progressPct } from "../utils.js";
import { useApp } from "../store.jsx";

/* 選択中アイテムの引き出し詳細パネル（棚の下に表示） */
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

  return (
    <div className="pullout" ref={ref} key={item.id}>
      <div className="pullout-cover">
        <Cover item={item} />
      </div>
      <div className="pullout-info">
        <div className="badge-row">
          <span className="badge">{TYPE_BADGE[item.type] || "ITEM"}</span>
          <span className="badge badge-muted">{STATUS_LABEL[item.status] || ""}</span>
          <span className="badge badge-muted">メモ {item.memo_count || 0}件</span>
        </div>
        <h2>{item.title}</h2>
        <p className="muted">{item.creator || ""}</p>
        {item.prog_total > 0 && (
          <div className="progress-wrap">
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${pct}%` }} />
            </div>
            <span className="progress-text">{item.prog_cur} / {item.prog_total}（{pct}%）</span>
          </div>
        )}
        <div className="pullout-actions">
          <button className="btn-primary" onClick={() => openDetail(item.id)}>詳細を見る</button>
          <button className="btn-secondary" onClick={() => openDetail(item.id, true)}>メモを書く</button>
        </div>
      </div>
    </div>
  );
}
