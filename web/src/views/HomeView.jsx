import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../store.jsx";
import { TYPE_FILTERS } from "../utils.js";
import Shelf, { EmptyShelf } from "../components/Shelf.jsx";
import PulloutPanel from "../components/PulloutPanel.jsx";
import ListRow from "../components/ListRow.jsx";
import { IconMemo, IconScan } from "../components/Icons.jsx";

const PAGE = 28;

export default function HomeView({ viewMode, setViewMode }) {
  const { toast, itemsVersion, setView, setTotalCount } = useApp();
  const [homeType, setHomeType] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [hasMore, setHasMore] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const loadingRef = useRef(false);
  const itemsRef = useRef([]);
  itemsRef.current = items;

  const load = useCallback(async (reset) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const offset = reset ? 0 : itemsRef.current.length;
      const qs = new URLSearchParams({ type: homeType, limit: PAGE, offset });
      const data = await api(`/api/items?${qs}`);
      const next = reset ? data.items : itemsRef.current.concat(data.items);
      setItems(next);
      setTotal(data.total);
      if (homeType === "") setTotalCount(data.total);
      setHasMore(next.length < data.total);
    } catch (e) {
      toast(e.message);
    } finally {
      loadingRef.current = false;
    }
  }, [homeType, toast, setTotalCount]);

  /* 初回・フィルター変更・アイテム変更時はリセット読み込み */
  useEffect(() => {
    setSelectedId(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeType, itemsVersion]);

  /* 種別ごとの件数（ピル表示用） */
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
    })();
    return () => { cancelled = true; };
  }, [itemsVersion]);

  const loadMore = useCallback(() => {
    if (hasMore) load(false);
  }, [hasMore, load]);

  const selectedItem = items.find((x) => x.id === selectedId) || null;
  const isEmpty = total === 0 && homeType === "";
  const grandTotal = counts[""] != null ? counts[""] : total;

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
            <p className="empty-text empty-onwood">この種別のアイテムはまだ登録されていません。</p>
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
    </section>
  );
}
