import React, { useEffect, useRef, useState } from "react";
import { api, downloadCsv } from "../api.js";
import { useApp } from "../store.jsx";
import { TYPE_FILTERS } from "../utils.js";
import ListRow from "../components/ListRow.jsx";
import { IconDownload } from "../components/Icons.jsx";

export default function SearchView() {
  const { toast, itemsVersion } = useApp();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [unread, setUnread] = useState(false);
  const [memoOnly, setMemoOnly] = useState(false);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const timer = useRef(null);

  const filterParams = () => {
    const p = { q: q.trim(), type };
    if (unread) p.unread = "1";
    if (memoOnly) p.withMemo = "1";
    return p;
  };

  const runSearch = async () => {
    try {
      const qs = new URLSearchParams({ ...filterParams(), limit: 60, offset: 0 });
      const data = await api(`/api/items?${qs}`);
      setResults(data.items);
      setSearched(true);
    } catch (e) {
      toast(e.message);
    }
  };

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(runSearch, 300);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, unread, memoOnly, itemsVersion]);

  const exportSearch = async () => {
    try {
      await downloadCsv(filterParams());
      toast("CSVをダウンロードしました");
    } catch (e) {
      toast(e.message);
    }
  };

  return (
    <section className="view">
      <h2 className="view-title">検索</h2>
      <input
        type="search"
        className="search-input"
        placeholder="タイトル・著者・アーティストで検索"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="chips">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`chip${type === f.value ? " active" : ""}`}
            onClick={() => setType(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="filter-toggles">
        <label className="toggle-label">
          <input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} /> 未読のみ
        </label>
        <label className="toggle-label">
          <input type="checkbox" checked={memoOnly} onChange={(e) => setMemoOnly(e.target.checked)} /> メモ付きのみ
        </label>
      </div>
      <div className="row-gap" style={{ margin: "12px 0" }}>
        <button className="btn-secondary btn-small" onClick={exportSearch}>
          <IconDownload size={15} /> この検索結果をCSVでダウンロード
        </button>
      </div>
      <div className="item-list">
        {results.map((item) => (
          <ListRow key={item.id} item={item} />
        ))}
        {searched && results.length === 0 && <p className="empty-text">見つかりませんでした。</p>}
      </div>
    </section>
  );
}
