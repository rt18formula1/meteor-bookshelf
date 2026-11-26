import React from "react";

/* 選択中アイテムの一括操作バー（一覧の上部に sticky 表示）。
   1件も選択されていない場合は何も表示しない */
export default function BulkBar({ count, onAddToFolder, onClear }) {
  if (!count || count <= 0) return null;
  return (
    <div className="bulk-bar">
      <span className="bulk-bar-count">{count}件選択中</span>
      <button type="button" className="btn-primary btn-small" onClick={onAddToFolder}>
        フォルダに追加
      </button>
      <button type="button" className="btn-secondary btn-small" onClick={onClear}>
        選択を解除
      </button>
    </div>
  );
}
