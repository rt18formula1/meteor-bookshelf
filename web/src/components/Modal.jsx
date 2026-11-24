import React, { useEffect } from "react";

/* 条件レンダリング専用モーダル。hidden 属性は使わない（旧バグの再発防止） */
export default function Modal({ onClose, children, labelledBy }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <button className="modal-close" onClick={onClose} aria-label="閉じる">×</button>
        {children}
      </div>
    </div>
  );
}
