import React, { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import Cover from "./Cover.jsx";
import { api, apiJson } from "../api.js";
import { useApp } from "../store.jsx";
import { TYPE_BADGE, fmtDate } from "../utils.js";
import { IconCamera } from "./Icons.jsx";

export default function ItemDetailModal() {
  const { detail, closeDetail, openCoverEditor, toast, bumpItems } = useApp();
  const [item, setItem] = useState(null);
  const [memos, setMemos] = useState([]);
  const [memoInput, setMemoInput] = useState("");
  const [fields, setFields] = useState(null);
  const [busy, setBusy] = useState(false);
  const memoRef = useRef(null);
  const coverFileRef = useRef(null);

  const id = detail && detail.id;

  const loadMemos = async (itemId) => {
    const data = await api(`/api/items/${itemId}/memos`);
    setMemos(data.memos);
  };

  useEffect(() => {
    if (!id) { setItem(null); setFields(null); setMemos([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const it = await api(`/api/items/${id}`);
        if (cancelled) return;
        setItem(it);
        setFields({
          type: it.type, status: it.status, title: it.title,
          creator: it.creator || "", publisher: it.publisher || "", isbn: it.isbn || "",
          prog_cur: it.prog_cur || "", prog_total: it.prog_total || "",
        });
        await loadMemos(id);
        if (detail.focusMemo && memoRef.current) {
          setTimeout(() => memoRef.current && memoRef.current.focus(), 120);
        }
      } catch (e) {
        toast(e.message);
        closeDetail();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!detail) return null;

  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (!item || busy) return;
    setBusy(true);
    try {
      const updated = await apiJson(`/api/items/${item.id}`, "PUT", {
        ...fields,
        cover_url: item.cover_url || "",
        image_key: item.image_key || "",
        prog_cur: fields.prog_cur === "" ? 0 : parseInt(fields.prog_cur, 10) || 0,
        prog_total: fields.prog_total === "" ? 0 : parseInt(fields.prog_total, 10) || 0,
      });
      setItem(updated);
      toast("保存しました");
      bumpItems();
      closeDetail();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    if (!window.confirm("このアイテムを削除しますか？メモも一緒に削除されます。")) return;
    try {
      await api(`/api/items/${item.id}`, { method: "DELETE" });
      toast("削除しました");
      bumpItems();
      closeDetail();
    } catch (e) { toast(e.message); }
  };

  const addMemo = async () => {
    const body = memoInput.trim();
    if (!body || !item) return;
    try {
      await apiJson(`/api/items/${item.id}/memos`, "POST", { body });
      setMemoInput("");
      await loadMemos(item.id);
      bumpItems();
      toast("メモを追加しました");
    } catch (e) { toast(e.message); }
  };

  const deleteMemo = async (memoId) => {
    if (!item) return;
    try {
      await api(`/api/memos/${memoId}`, { method: "DELETE" });
      await loadMemos(item.id);
      bumpItems();
    } catch (e) { toast(e.message); }
  };

  const onCoverSelected = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f || !item) return;
    openCoverEditor(f, async (key) => {
      try {
        const updated = await apiJson(`/api/items/${item.id}`, "PUT", { ...item, image_key: key });
        setItem(updated);
        bumpItems();
        toast("表紙を更新しました");
      } catch (err) { toast(err.message); }
    });
  };

  return (
    <Modal onClose={closeDetail}>
      {!item || !fields ? (
        <p className="muted" style={{ padding: "24px 0" }}>読み込み中…</p>
      ) : (
        <>
          <div className="detail-head">
            <div className="detail-cover">
              <Cover item={item} />
            </div>
            <div className="detail-head-info">
              <div className="badge-row">
                <span className="badge">{TYPE_BADGE[item.type] || "ITEM"}</span>
                {item.isbn && <span className="badge badge-muted">ISBN {item.isbn}</span>}
              </div>
              <h2>{item.title}</h2>
              <p className="muted">{item.creator || ""}</p>
              <p className="muted small">{item.publisher || ""}</p>
              <button type="button" className="btn-secondary btn-small" onClick={() => coverFileRef.current && coverFileRef.current.click()}>
                <IconCamera size={15} /> 表紙の写真を変更
              </button>
              <input ref={coverFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onCoverSelected} />
            </div>
          </div>

          <form onSubmit={save}>
            <div className="form-grid">
              <label>状態
                <select value={fields.status} onChange={set("status")}>
                  <option value="unread">未読 / 未視聴</option>
                  <option value="reading">読み進め中 / 視聴中</option>
                  <option value="done">読了 / 視聴済み</option>
                </select>
              </label>
              <label>種別
                <select value={fields.type} onChange={set("type")}>
                  <option value="book">書籍</option>
                  <option value="cd">CD</option>
                  <option value="dvd">DVD</option>
                  <option value="other">その他</option>
                </select>
              </label>
              <label>進捗（現在）<input type="number" min="0" value={fields.prog_cur} onChange={set("prog_cur")} placeholder="182" /></label>
              <label>進捗（全体）<input type="number" min="0" value={fields.prog_total} onChange={set("prog_total")} placeholder="285" /></label>
              <label>タイトル<input type="text" value={fields.title} onChange={set("title")} required /></label>
              <label>著者 / アーティスト<input type="text" value={fields.creator} onChange={set("creator")} /></label>
              <label>出版社 / レーベル<input type="text" value={fields.publisher} onChange={set("publisher")} /></label>
              <label>ISBN / バーコード<input type="text" value={fields.isbn} onChange={set("isbn")} /></label>
            </div>
            <div className="row-gap">
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "保存中…" : "保存する"}</button>
              <button type="button" className="btn-danger" onClick={remove}>このアイテムを削除</button>
            </div>
          </form>

          <div className="divider" />
          <h3>メモ <span className="muted small">（{memos.length}件）</span></h3>
          <div className="row-gap">
            <textarea ref={memoRef} rows={3} value={memoInput} onChange={(e) => setMemoInput(e.target.value)} placeholder="読書メモ・視聴メモを書く" />
          </div>
          <button className="btn-primary btn-small" onClick={addMemo} style={{ marginTop: 8 }}>メモを追加</button>
          <div className="memo-list">
            {memos.map((m) => (
              <div className="memo-card" key={m.id}>
                <div className="memo-body">{m.body}</div>
                <div className="memo-meta">
                  <span className="memo-date">{fmtDate(m.created_at)}</span>
                  <button className="memo-del" onClick={() => deleteMemo(m.id)}>削除</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
