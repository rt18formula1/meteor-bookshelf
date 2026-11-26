import React, { useEffect, useRef, useState } from "react";
import { api, downloadCsv } from "../api.js";
import { useApp } from "../store.jsx";
import { TYPE_FILTERS } from "../utils.js";
import ListRow from "../components/ListRow.jsx";
import BulkBar from "../components/BulkBar.jsx";
import BulkFolderModal from "../components/BulkFolderModal.jsx";
import FolderManagerModal from "../components/FolderManagerModal.jsx";
import { IconDownload } from "../components/Icons.jsx";

export default function SearchView() {
  const { toast, itemsVersion, bumpItems, bumpFolders } = useApp();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [unread, setUnread] = useState(false);
  const [memoOnly, setMemoOnly] = useState(false);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  /* 一括追加の選択状態（検索ビュー内で独立） */
  const [selected, setSelected] = useState(() => new Set());
  const [showBulk, setShowBulk] = useState(false);
  const [showFolderManager, setShowFolderManager] = useState(false);
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

  /* 選択のトグル。表示から消えたアイテムの選択は解除する */
  const toggleSelect = (id, checked) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  useEffect(() => {
    const visible = new Set(results.map((r) => r.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [results]);

  const handleBulkDone = (data, folderName) => {
    setShowBulk(false);
    setSelected(new Set());
    if (data.updated > 0) {
      toast(`${data.updated}件を「${folderName}」に追加しました${data.already > 0 ? `（${data.already}件はすでに入っていました）` : ""}`);
    } else {
      toast(`すべて「${folderName}」にすでに入っています`);
    }
    bumpItems();
    bumpFolders();
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
      <BulkBar
        count={selected.size}
        onAddToFolder={() => setShowBulk(true)}
        onClear={() => setSelected(new Set())}
      />
      <div className="item-list">
        {results.map((item) => (
          <ListRow
            key={item.id}
            item={item}
            selectable
            checked={selected.has(item.id)}
            onToggle={toggleSelect}
          />
        ))}
        {searched && results.length === 0 && <p className="empty-text">見つかりませんでした。</p>}
      </div>
      {showBulk && (
        <BulkFolderModal
          ids={[...selected]}
          onClose={() => setShowBulk(false)}
          onDone={handleBulkDone}
          onOpenManager={() => setShowFolderManager(true)}
        />
      )}
      {showFolderManager && <FolderManagerModal onClose={() => setShowFolderManager(false)} />}
    </section>
  );
}
