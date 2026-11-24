import React from "react";
import Spine from "./Spine.jsx";
import { IconPlus } from "./Icons.jsx";

export const ROW_SIZE = 14;

/* 1段分: 背面パネル（木目）＋背表紙スクローラー＋棚板 */
export function ShelfRow({ items, selectedId, onSelect, onScrollEnd }) {
  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (onScrollEnd && el.scrollLeft + el.clientWidth > el.scrollWidth - 240) onScrollEnd();
  };
  return (
    <div className="shelf-row">
      <div className="shelf-back">
        <div className="shelf-scroller" onScroll={handleScroll}>
          {items.map((item) => (
            <Spine key={item.id} item={item} selected={item.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
      </div>
      <div className="shelf-board" />
    </div>
  );
}

/* 本棚全体: 木製の書棚（側面・天面の陰影つき） */
export default function Shelf({ items, selectedId, onSelect, onScrollEnd }) {
  const rows = [];
  for (let i = 0; i < items.length; i += ROW_SIZE) rows.push(items.slice(i, i + ROW_SIZE));
  return (
    <div className="bookcase">
      <div className="bookcase-top" />
      {rows.map((rowItems, i) => (
        <ShelfRow
          key={i}
          items={rowItems}
          selectedId={selectedId}
          onSelect={onSelect}
          onScrollEnd={i === rows.length - 1 ? onScrollEnd : undefined}
        />
      ))}
    </div>
  );
}

/* 空状態: 空の木棚2段＋CTA */
export function EmptyShelf({ onAdd }) {
  return (
    <div className="bookcase bookcase-empty">
      <div className="bookcase-top" />
      <ShelfRow items={[]} selectedId={null} onSelect={() => {}} />
      <ShelfRow items={[]} selectedId={null} onSelect={() => {}} />
      <div className="empty-cta">
        <p className="empty-cta-text">まだ何も登録されていません</p>
        <button className="btn-primary" onClick={onAdd}>
          <IconPlus size={18} /> 最初の1冊を登録する
        </button>
      </div>
    </div>
  );
}
