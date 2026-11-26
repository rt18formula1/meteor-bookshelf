import React, { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { apiJson, listFolders } from "../api.js";
import { useApp } from "../store.jsx";

/* 選択中のアイテムを1つのフォルダへ一括追加するモーダル。
   ids: 追加するアイテムIDの配列。onDone(data, folderName): 追加完了時のコールバック。
   onOpenManager: フォルダが0件のときにフォルダ管理を開くためのコールバック */
export default function BulkFolderModal({ ids, onClose, onDone, onOpenManager }) {
  const { toast } = useApp();
  const [folders, setFolders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listFolders();
        if (!cancelled) setFolders(data.folders || []);
      } catch (e) {
        toast(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const submit = async () => {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      const data = await apiJson("/api/items/bulk-folders", "POST", { ids, folder_id: selectedId });
      const folder = folders.find((f) => f.id === selectedId);
      onDone(data, folder ? folder.name : "");
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="bulk-folder-title">
      <h2 id="bulk-folder-title">フォルダに追加</h2>
      <p className="muted small">{ids.length}件をフォルダに追加します。すでに入っているものはそのまま残ります。</p>
      {folders.length === 0 ? (
        <div>
          <p className="empty-text">フォルダはまだありません。</p>
          <div className="row-gap" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => { onClose(); if (onOpenManager) onOpenManager(); }}
            >
              フォルダを作成する
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>キャンセル</button>
          </div>
        </div>
      ) : (
        <>
          <div className="bulk-folder-list">
            {folders.map((f) => (
              <label key={f.id} className={`bulk-folder-row${selectedId === f.id ? " bulk-folder-row-selected" : ""}`}>
                <input
                  type="radio"
                  name="bulk-folder"
                  checked={selectedId === f.id}
                  onChange={() => setSelectedId(f.id)}
                />
                <span className="bulk-folder-name">{f.name}</span>
                <span className="muted small">{f.item_count}点</span>
              </label>
            ))}
          </div>
          <div className="row-gap" style={{ marginTop: 16 }}>
            <button type="button" className="btn-primary" disabled={!selectedId || busy} onClick={submit}>
              {busy ? "追加中…" : "追加する"}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>キャンセル</button>
          </div>
        </>
      )}
    </Modal>
  );
}
