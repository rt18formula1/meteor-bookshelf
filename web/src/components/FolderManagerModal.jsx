import React, { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { createFolder, deleteFolder, listFolders, reorderFolders, updateFolder } from "../api.js";
import { useApp } from "../store.jsx";

/* フォルダ管理モーダル：作成・名前変更・公開切替・並び替え・削除。
   公開中のフォルダには共有URLを表示し、コピーできるようにする */
export default function FolderManagerModal({ onClose }) {
  const { toast, bumpFolders, bumpItems } = useApp();
  const [folders, setFolders] = useState([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data = await listFolders();
      setFolders(data.folders || []);
    } catch (e) {
      toast(e.message);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const refresh = () => { load(); bumpFolders(); };

  const add = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await createFolder(name);
      setNewName("");
      toast("フォルダを作成しました");
      refresh();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveName = async (folder) => {
    const name = editingName.trim();
    if (!name || name === folder.name) { setEditingId(null); return; }
    try {
      await updateFolder(folder.id, { name });
      setEditingId(null);
      toast("名前を変更しました");
      refresh();
    } catch (err) {
      toast(err.message);
    }
  };

  const togglePublic = async (folder) => {
    try {
      await updateFolder(folder.id, { is_public: !folder.is_public });
      toast(folder.is_public ? "非公開にしました" : "公開しました。共有URLから誰でも見られます");
      refresh();
    } catch (err) {
      toast(err.message);
    }
  };

  const remove = async (folder) => {
    if (!window.confirm(`フォルダ「${folder.name}」を削除しますか？\n中のアイテムは「未分類」に戻り、アイテム自体は削除されません。`)) return;
    try {
      await deleteFolder(folder.id);
      toast("フォルダを削除しました");
      refresh();
      bumpItems();
    } catch (err) {
      toast(err.message);
    }
  };

  const move = async (idx, dir) => {
    const next = [...folders];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return;
    const [it] = next.splice(idx, 1);
    next.splice(to, 0, it);
    setFolders(next);
    try {
      await reorderFolders(next.map((f) => f.id));
      bumpFolders();
    } catch (err) {
      toast(err.message);
      load();
    }
  };

  const copyUrl = async (folder) => {
    const url = `${window.location.origin}/s/${folder.share_id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("共有URLをコピーしました");
    } catch (_) {
      /* クリップボードが使えない場合はURLを表示する */
      window.prompt("共有URL", url);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2>フォルダ管理</h2>
      <p className="muted small">
        本棚をフォルダで分けられます。フォルダを公開すると、共有URLからログインなしで見られるようになります。
      </p>

      <form onSubmit={add} className="row-gap" style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新しいフォルダ名（例：漫画）"
          maxLength={60}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn-primary btn-small" disabled={busy || !newName.trim()}>
          追加
        </button>
      </form>

      {folders.length === 0 && <p className="empty-text">フォルダはまだありません。</p>}

      <div className="folder-list">
        {folders.map((folder, idx) => (
          <div key={folder.id} className="folder-row">
            <div className="folder-row-main">
              {editingId === folder.id ? (
                <input
                  type="text"
                  value={editingName}
                  autoFocus
                  maxLength={60}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => saveName(folder)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName(folder);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="folder-name"
                  onClick={() => { setEditingId(folder.id); setEditingName(folder.name); }}
                  title="クリックで名前を変更"
                >
                  {folder.name}
                </button>
              )}
              <span className="muted small">{folder.item_count}点</span>
              <span className={`badge${folder.is_public ? "" : " badge-muted"}`}>
                {folder.is_public ? "公開中" : "非公開"}
              </span>
            </div>
            {folder.is_public && (
              <div className="folder-share-url">
                <code>{`${window.location.origin}/s/${folder.share_id}`}</code>
                <button type="button" className="btn-secondary btn-small" onClick={() => copyUrl(folder)}>
                  URLをコピー
                </button>
              </div>
            )}
            <div className="folder-row-actions">
              <button
                type="button"
                className={`btn-secondary btn-small${folder.is_public ? " folder-public-on" : ""}`}
                onClick={() => togglePublic(folder)}
              >
                {folder.is_public ? "非公開にする" : "公開する"}
              </button>
              <button type="button" className="btn-secondary btn-small" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="上へ">↑</button>
              <button type="button" className="btn-secondary btn-small" disabled={idx === folders.length - 1} onClick={() => move(idx, 1)} aria-label="下へ">↓</button>
              <button type="button" className="btn-danger btn-small" onClick={() => remove(folder)}>削除</button>
            </div>
          </div>
        ))}
      </div>

      <div className="row-gap" style={{ marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>閉じる</button>
      </div>
    </Modal>
  );
}
