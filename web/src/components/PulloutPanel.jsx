import React, { useEffect, useRef } from "react";
import { STATUS_LABEL, TYPE_BADGE, externalLinks, fmtPrice, progressPct } from "../utils.js";
import { useApp } from "../store.jsx";
import Cover from "./Cover.jsx";
import { IconMemo } from "./Icons.jsx";

/* 選択中アイテムの詳細カード（参考イメージのカード様式）
   左に表表紙（棚から引き出して開くアニメーション）、右にメタ情報 */
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
  const links = externalLinks(item);

  const meta = [
    ["出版社 / レーベル", item.publisher],
    ["規格品番", item.catno],
    ["ISBN / バーコード", item.isbn],
    ["版・仕様", item.edition],
    ["価格", fmtPrice(item.price)],
    ["保有場所", item.location],
    ["カテゴリー", item.category],
  ].filter(([, v]) => v != null && String(v).trim() !== "");

  return (
    <div className="pullout" ref={ref} key={item.id}>
      <div className="pullout-body">
        <div className="pullout-cover-wrap">
          <Cover item={item} className="pullout-cover" />
        </div>
        <div className="pullout-main">
          <div className="badge-row card-badges">
            <span className="badge badge-outline">{TYPE_BADGE[item.type] || "ITEM"}</span>
            <span className={`badge badge-status status-${item.status}`}>{STATUS_LABEL[item.status] || ""}</span>
            <span className="card-memo-count">
              <IconMemo size={16} /> メモ {item.memo_count || 0}件
            </span>
          </div>
          <h2 className="card-title">{item.title}</h2>
          <p className="card-creator">{item.creator || ""}</p>
          {meta.length > 0 && (
            <dl className="meta-grid">
              {meta.map(([k, v]) => (
                <div className="meta-row" key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
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
          {links.length > 0 && (
            <div className="ext-links">
              {links.map((l) => (
                <a key={l.label} className="ext-link" href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
          <div className="pullout-actions">
            <button className="btn-primary" onClick={() => openDetail(item.id)}>詳細を見る</button>
            <button className="btn-secondary" onClick={() => openDetail(item.id, true)}>メモを書く</button>
          </div>
        </div>
      </div>
    </div>
  );
}
