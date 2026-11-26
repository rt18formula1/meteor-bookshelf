import React, { useEffect, useRef } from "react";
import Spine from "./Spine.jsx";
import { IconPlus } from "./Icons.jsx";

const IDLE_MS = 10000; // 放置してから自動スクロールを開始するまでの時間
const AUTO_SPEED_PX_PER_S = 25; // ゆったりした自動スクロールの速度（毎秒25px）
const VEL_TAU_MS = 150; // 速度を目標へ近づける時定数（端での反転を滑らかにする）

/* ヒーロー棚: 楢材の背面＋1段の横スクロール棚（参考イメージの構図）
   10秒放置するとゆったり自動スクロール（ピンポン往復）する */
export default function Shelf({ items, selectedId, onSelect, onScrollEnd, onAdd }) {
  const scrollerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const rafRef = useRef(null);
  const dirRef = useRef(1); // 進行方向 +1（右）／-1（左）
  const velRef = useRef(0); // 現在の速度（px/s）
  const lastTimeRef = useRef(0);
  const autoRef = useRef(false); // 自動スクロール中かどうか

  const stopAuto = () => {
    autoRef.current = false;
    velRef.current = 0;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const scheduleStart = (delayMs) => {
    if (idleTimerRef.current != null) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(tryStart, delayMs);
  };

  const tryStart = () => {
    const el = scrollerRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.scrollWidth <= el.clientWidth + 1) {
      // まだ横スクロールできない（アイテム読み込み待ち等）: 後で再確認する
      scheduleStart(2000);
      return;
    }
    startAuto();
  };

  const startAuto = () => {
    const el = scrollerRef.current;
    if (!el || autoRef.current) return;
    // 右端にいる場合は左向きから開始する
    if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) dirRef.current = -1;
    else if (el.scrollLeft <= 0) dirRef.current = 1;
    autoRef.current = true;
    lastTimeRef.current = performance.now();
    const step = (now) => {
      if (!autoRef.current) return;
      const target = scrollerRef.current;
      if (!target) {
        autoRef.current = false;
        return;
      }
      const dt = Math.min(0.1, Math.max(0, (now - lastTimeRef.current) / 1000));
      lastTimeRef.current = now;
      const goal = dirRef.current * AUTO_SPEED_PX_PER_S;
      // 速度を目標へ指数関数的に近づける: 端で目標速度が反転しても
      // 実際の速度は約150〜300msかけて滑らかに 0 を横切って反転する
      velRef.current += (goal - velRef.current) * (1 - Math.exp(-dt / (VEL_TAU_MS / 1000)));
      const max = target.scrollWidth - target.clientWidth;
      let next = target.scrollLeft + velRef.current * dt;
      if (next >= max) {
        next = max;
        dirRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        dirRef.current = 1;
      }
      target.scrollLeft = next;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  // 操作したら自動スクロールを止め、放置タイマーを最初から数え直す
  const resetIdleTimer = () => {
    stopAuto();
    scheduleStart(IDLE_MS);
  };

  useEffect(() => {
    scheduleStart(IDLE_MS);
    return () => {
      stopAuto();
      if (idleTimerRef.current != null) clearTimeout(idleTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (onScrollEnd && el.scrollLeft + el.clientWidth > el.scrollWidth - 240) onScrollEnd();
    // 自動スクロール中の scroll イベントはプログラムによるものなので無視し、
    // ユーザー自身のスクロールのときだけ放置タイマーを数え直す
    if (!autoRef.current) resetIdleTimer();
  };

  return (
    <div className="hero-shelf">
      <div className="shelf-rail-top" />
      <div
        className="shelf-scroller"
        ref={scrollerRef}
        onScroll={handleScroll}
        onWheel={resetIdleTimer}
        onTouchStart={resetIdleTimer}
        onPointerDown={resetIdleTimer}
        onClick={resetIdleTimer}
        onMouseEnter={resetIdleTimer}
      >
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
