import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../store.jsx";
import { TYPE_FILTERS } from "../utils.js";
import Shelf, { EmptyShelf } from "../components/Shelf.jsx";
import PulloutPanel from "../components/PulloutPanel.jsx";
import ListRow from "../components/ListRow.jsx";

const PAGE = 28;

export default function HomeView({ viewMode }) {
  const { toast, itemsVersion, setView, setTotalCount } = useApp();
  const [homeType, setHomeType] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
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
      setTotalCount(data.total);
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

  const loadMore = useCallback(() => {
    if (hasMore) load(false);
  }, [hasMore, load]);

  const selectedItem = items.find((x) => x.id === selectedId) || null;
  const isEmpty = total === 0 && homeType === "";

  return (
    <section className="view">
      <div className="chips">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`chip${homeType === f.value ? " active" : ""}`}
            onClick={() => setHomeType(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {viewMode === "shelf" ? (
        <>
          {isEmpty ? (
            <EmptyShelf onAdd={() => setView("scan")} />
          ) : items.length === 0 ? (
            <p className="empty-text">この種別のアイテムはまだ登録されていません。</p>
          ) : (
            <Shelf items={items} selectedId={selectedId} onSelect={setSelectedId} onScrollEnd={loadMore} />
          )}
          <PulloutPanel item={selectedItem} />
        </>
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
