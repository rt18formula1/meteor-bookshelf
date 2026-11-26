import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, apiJson, listFolders } from "../api.js";
import { useApp } from "../store.jsx";
import { TYPE_FILTERS, coverSrc, spineColor } from "../utils.js";
import Shelf, { EmptyShelf } from "../components/Shelf.jsx";
import PulloutPanel from "../components/PulloutPanel.jsx";
import ListRow from "../components/ListRow.jsx";
import AuthedImage from "../components/AuthedImage.jsx";
import FolderManagerModal from "../components/FolderManagerModal.jsx";
import ShareModal from "../components/ShareModal.jsx";
import { IconFolder, IconMemo, IconScan, IconShare } from "../components/Icons.jsx";

const PAGE = 28;

const SORT_OPTIONS = [
  { value: "manual", label: "手動の並び順" },
  { value: "title", label: "タイトル順" },
  { value: "creator", label: "作者順" },
  { value: "category", label: "カテゴリー順" },
  { value: "new", label: "新しい順" },
  { value: "old", label: "古い順" },
  { value: "type", label: "種別順" },
];

export default function HomeView({ viewMode, setViewMode }) {
  const { toast, itemsVersion, foldersVersion, setView, setTotalCount, bumpItems } = useApp();
  const [homeType, setHomeType] = useState("");
  const [folder, setFolder] = useState(""); // ""=すべて, "none"=未分類, フォルダID（文字列）=そのフォルダ
  const [folders, setFolders] = useState([]);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [hasMore, setHasMore] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [sort, setSort] = useState("manual");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  /* 編集モード（並べ替え） */
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [editBusy, setEditBusy] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const loadingRef = useRef(false);
  const itemsRef = useRef([]);
  itemsRef.current = items;

  const load = useCallback(async (reset) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const offset = reset ? 0 : itemsRef.current.length;
      const qs = new URLSearchParams({ type: homeType, limit: PAGE, offset, sort });
      if (category) qs.set("category", category);
      if (folder === "none") qs.set("folder", "none");
      else if (folder) qs.set("folder", folder);
      const data = await api(`/api/items?${qs}`);
      const next = reset ? data.items : itemsRef.current.concat(data.items);
      setItems(next);
      setTotal(data.total);
      if (homeType === "" && folder === "") setTotalCount(data.total);
      setHasMore(next.length < data.total);
    } catch (e) {
      toast(e.message);
    } finally {
      loadingRef.current = false;
    }
  }, [homeType, sort, category, folder, toast, setTotalCount]);

  /* 初回・フィルター/並び順変更・アイテム変更時はリセット読み込み */
  useEffect(() => {
    setSelectedId(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeType, sort, category, folder, itemsVersion]);

  /* フォルダ一覧（件数付き）。アイテム変更でも件数が変わるため itemsVersion も見る */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listFolders();
        if (!cancelled) setFolders(data.folders || []);
      } catch { /* フォルダが取れない場合はチップを出さない */ }
    })();
    return () => { cancelled = true; };
  }, [foldersVersion, itemsVersion]);

  /* 種別ごとの件数（ピル表示用）＋カテゴリー候補 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(
          TYPE_FILTERS.map(async (f) => {
            const qs = new URLSearchParams({ type: f.value, limit: 1, offset: 0 });
            const data = await api(`/api/items?${qs}`);
            return [f.value, data.total];
          })
        );
        if (!cancelled) setCounts(Object.fromEntries(entries));
      } catch {
        /* 件数が取れない場合はピルに数字を出さない */
      }
      try {
        const labels = await api("/api/labels");
        if (!cancelled) setCategories(labels.categories || []);
      } catch { /* 候補が取れない場合は絞り込みを出さない */ }
    })();
    return () => { cancelled = true; };
  }, [itemsVersion]);

  const loadMore = useCallback(() => {
    if (hasMore) load(false);
  }, [hasMore, load]);

  /* ---- 編集モード（並べ替え） ---- */
  const startEdit = async () => {
    try {
      const data = await api(`/api/items?sort=manual&limit=1000&offset=0`);
      setEditItems(data.items);
      setEditing(true);
    } catch (e) {
      toast(e.message);
    }
  };
  const moveEdit = (from, to) => {
    if (to < 0) return;
    setEditItems((prev) => {
      if (from === to || to >= prev.length) return prev;
      const next = [...prev];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  };
  const saveEdit = async () => {
    if (editBusy) return;
    setEditBusy(true);
    try {
      await apiJson("/api/items/reorder", "PUT", { ids: editItems.map((i) => i.id) });
      setEditing(false);
      toast("並び順を保存しました");
      bumpItems();
    } catch (e) {
      toast(e.message);
    } finally {
      setEditBusy(false);
    }
  };
  const cancelEdit = () => {
    setEditing(false);
    setEditItems([]);
    setDragIdx(null);
    setOverIdx(null);
  };

  const selectedItem = items.find((x) => x.id === selectedId) || null;
  const isEmpty = total === 0 && homeType === "" && category === "" && folder === "";
  const grandTotal = counts[""] != null ? counts[""] : total;
  /* 未分類の件数 = 全体 - 各フォルダの件数の合計 */
  const folderCountSum = folders.reduce((s, f) => s + (f.item_count || 0), 0);
  const uncategorizedCount = Math.max(0, grandTotal - folderCountSum);
  const selectedFolder = folder && folder !== "none" ? folders.find((f) => String(f.id) === folder) || null : null;

  if (editing) {
    return (
      <section className="view view-home">
        <div className="edit-banner">
          <strong>並べ替え編集中</strong>
          <span>ドラッグ、または ↑↓ ボタンで順序を変更し、「完了」で保存します（全{editItems.length}件・フィルターなし）。</span>
        </div>
        <div className="reorder-list">
          {editItems.map((item, idx) => (
            <div
              key={item.id}
              className={`reorder-row${dragIdx === idx ? " dragging" : ""}${overIdx === idx && dragIdx !== idx ? " dragover" : ""}`}
              draggable
              onDragStart={(e) => { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(idx); }}
              onDrop={(e) => { e.preventDefault(); if (dragIdx != null) moveEdit(dragIdx, idx); setDragIdx(null); setOverIdx(null); }}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            >
              <span className="reorder-handle" title="ドラッグで並べ替え">⠿</span>
              {coverSrc(item) ? (
                <AuthedImage src={coverSrc(item)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <span className="reorder-thumb-gen" style={{ background: spineColor(item) }}>{(item.title || "").slice(0, 1)}</span>
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="reorder-title">{item.title}</span>
                <span className="reorder-sub">{item.creator || ""}{item.category ? ` ／ ${item.category}` : ""}</span>
              </span>
              <span className="reorder-move">
                <button type="button" disabled={idx === 0} onClick={() => moveEdit(idx, idx - 1)} aria-label="上へ">↑</button>
                <button type="button" disabled={idx === editItems.length - 1} onClick={() => moveEdit(idx, idx + 1)} aria-label="下へ">↓</button>
              </span>
            </div>
          ))}
          {editItems.length === 0 && <p className="empty-text">まだ何も登録されていません。</p>}
        </div>
        <div className="row-gap" style={{ marginTop: 14 }}>
          <button className="btn-primary" onClick={saveEdit} disabled={editBusy}>{editBusy ? "保存中…" : "完了"}</button>
          <button className="btn-secondary" onClick={cancelEdit} disabled={editBusy}>キャンセル</button>
        </div>
      </section>
    );
  }

  return (
    <section className="view view-home">
      {/* ヒーロー: 楢棚の上にタイトルとスキャンボタン（参考イメージの構図） */}
      <div className="hero">
        <div className="hero-head">
          <div className="hero-titleblock">
            <p className="hero-eyebrow">私の本棚 — Bookshelf</p>
            <div className="hero-titlerow">
              <h1 className="hero-title">私の本棚</h1>
              <span className="hero-count">全{grandTotal}点</span>
            </div>
          </div>
          <div className="hero-scanblock">
            <button className="hero-scan" onClick={() => setView("scan")}>
              <IconScan size={19} /> スキャン
            </button>
            <p className="hero-scan-caption">バーコードで3秒追加</p>
          </div>
        </div>

        {viewMode === "shelf" && (
          isEmpty ? (
            <EmptyShelf onAdd={() => setView("scan")} />
          ) : items.length === 0 ? (
            <p className="empty-text empty-onwood">この条件のアイテムはまだ登録されていません。</p>
          ) : (
            <Shelf
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onScrollEnd={loadMore}
              onAdd={() => setView("scan")}
            />
          )
        )}
      </div>

      {/* フォルダチップ（すべて／未分類／各フォルダ）＋フォルダ管理・共有 */}
      <div className="folder-bar">
        <div className="chips">
          <button
            className={`chip${folder === "" ? " active" : ""}`}
            onClick={() => setFolder("")}
          >
            すべて<span className="chip-count">{grandTotal}</span>
          </button>
          <button
            className={`chip${folder === "none" ? " active" : ""}`}
            onClick={() => setFolder("none")}
          >
            未分類<span className="chip-count">{uncategorizedCount}</span>
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              className={`chip${folder === String(f.id) ? " active" : ""}`}
              onClick={() => setFolder(String(f.id))}
            >
              <IconFolder size={15} /> {f.name}
              <span className="chip-count">{f.item_count}</span>
              {f.is_public ? <span className="chip-public">公開</span> : null}
            </button>
          ))}
        </div>
        <div className="folder-bar-actions">
          <button className="btn-secondary btn-small" onClick={() => setShowFolderManager(true)}>
            <IconFolder size={15} /> フォルダ管理
          </button>
          <button className="btn-secondary btn-small" onClick={() => setShowShare(true)}>
            <IconShare size={15} /> 共有
          </button>
        </div>
      </div>

      {/* 種別ピル（件数つき・ダーク）＋表示切替 */}
      <div className="pills-row">
        <div className="chips chips-dark">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`chip chip-dark${homeType === f.value ? " active" : ""}`}
              onClick={() => setHomeType(f.value)}
            >
              {f.label}
              {counts[f.value] != null && <span className="chip-count">{counts[f.value]}</span>}
            </button>
          ))}
        </div>
        <div className="view-toggle">
          <button className={`toggle-btn${viewMode === "shelf" ? " active" : ""}`} onClick={() => setViewMode("shelf")}>本棚</button>
          <button className={`toggle-btn${viewMode === "list" ? " active" : ""}`} onClick={() => setViewMode("list")}>リスト</button>
        </div>
      </div>

      {/* 並び順・カテゴリー絞り込み・編集（並べ替え） */}
      <div className="controls-row">
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="並び順">
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="カテゴリーで絞り込み">
          <option value="">カテゴリー: すべて</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="controls-spacer" />
        <button
          className="btn-secondary btn-small"
          onClick={startEdit}
          disabled={sort !== "manual"}
          title={sort !== "manual" ? "並べ替えは「手動の並び順」のときだけ使えます" : "並べ替え編集を開く"}
        >
          編集（並べ替え）
        </button>
      </div>

      {viewMode === "shelf" ? (
        selectedItem && (
          <>
            <h3 className="section-heading">
              <IconMemo size={19} /> 選択中の作品
            </h3>
            <PulloutPanel item={selectedItem} />
          </>
        )
      ) : (
        <div>
          <div className="item-list">
            {items.map((item) => (
              <ListRow key={item.id} item={item} />
            ))}
            {items.length === 0 && <p className="empty-text">まだ何も登録されていません。</p>}
          </div>
          {hasMore && (
            <button className="btn-secondary btn-block" onClick={loadMore}>もっと見る</button>
          )}
        </div>
      )}

      {showFolderManager && <FolderManagerModal onClose={() => setShowFolderManager(false)} />}
      {showShare && <ShareModal folder={selectedFolder} onClose={() => setShowShare(false)} />}
    </section>
  );
}
