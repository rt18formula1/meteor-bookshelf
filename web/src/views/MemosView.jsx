import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../store.jsx";
import { fmtDate } from "../utils.js";

export default function MemosView() {
  const { toast, openDetail, itemsVersion } = useApp();
  const [memos, setMemos] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/api/memos");
        if (!cancelled) setMemos(data.memos);
      } catch (e) {
        toast(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [itemsVersion, toast]);

  return (
    <section className="view">
      <h2 className="view-title">メモ</h2>
      <div className="memo-list">
        {(memos || []).map((m) => (
          <div className="memo-card" key={m.id}>
            <div className="memo-body">{m.body}</div>
            <div className="memo-meta">
              <span className="memo-item-title" onClick={() => openDetail(m.item_id)}>
                『{m.item_title}』
              </span>
              <span className="memo-date">{fmtDate(m.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
      {memos && memos.length === 0 && (
        <p className="empty-text">まだメモがありません。本の詳細から読書メモ・視聴メモを書き込めます。</p>
      )}
    </section>
  );
}
