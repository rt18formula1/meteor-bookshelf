import React from "react";
import Spine from "./Spine.jsx";
import { IconPlus } from "./Icons.jsx";

/* ヒーロー棚: 楢材の背面＋1段の横スクロール棚（参考イメージの構図） */
export default function Shelf({ items, selectedId, onSelect, onScrollEnd, onAdd }) {
  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (onScrollEnd && el.scrollLeft + el.clientWidth > el.scrollWidth - 240) onScrollEnd();
  };
  return (
    <div className="hero-shelf">
      <div className="shelf-rail-top" />
      <div className="shelf-scroller" onScroll={handleScroll}>
        {items.map((item) => (
          <Spine key={item.id} item={item} selected={item.id === selectedId} onSelect={onSelect} />
        ))}
        <button className="spine-add" onClick={onAdd} aria-label="新しく追加">
          <IconPlus size={22} />
        </button>
      </div>
      <div className="shelf-board" />
      <div className="scroll-hint">
        <span className="scroll-hint-mark">»</span> 横にスクロール
      </div>
    </div>
  );
}

/* 空状態: 空の楢棚＋CTA */
export function EmptyShelf({ onAdd }) {
  return (
    <div className="hero-shelf hero-shelf-empty">
      <div className="shelf-rail-top" />
      <div className="shelf-scroller shelf-scroller-empty" />
      <div className="shelf-board" />
      <div className="empty-cta">
        <p className="empty-cta-text">まだ何も登録されていません</p>
        <button className="btn-primary" onClick={onAdd}>
          <IconPlus size={18} /> 最初の1冊を登録する
        </button>
      </div>
    </div>
  );
}
