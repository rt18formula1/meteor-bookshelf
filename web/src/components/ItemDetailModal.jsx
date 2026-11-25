import React, { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import Cover from "./Cover.jsx";
import { api, apiJson, apiImageObjectUrl } from "../api.js";
import { useApp } from "../store.jsx";
import { TYPE_BADGE, externalLinks, fmtDate, fmtPrice } from "../utils.js";
import { IconCamera } from "./Icons.jsx";
import AuthedImage from "./AuthedImage.jsx";

export default function ItemDetailModal() {
  const { detail, closeDetail, openCoverEditor, toast, bumpItems } = useApp();
  const [item, setItem] = useState(null);
  const [memos, setMemos] = useState([]);
  const [memoInput, setMemoInput] = useState("");
  const [fields, setFields] = useState(null);
  const [busy, setBusy] = useState(false);
  const [labels, setLabels] = useState({ locations: [], categories: [] });
  const [slotBusy, setSlotBusy] = useState(false);
  const memoRef = useRef(null);
  const coverFileRef = useRef(null);
  const slotFileRef = useRef(null);
  const slotFieldRef = useRef(null);

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
          creator: it.creator || "", publisher: it.publisher || "", isbn: it.isbn || "", catno: it.catno || "",
          edition: it.edition || "", price: it.price || "", location: it.location || "", category: it.category || "",
          prog_cur: it.prog_cur || "", prog_total: it.prog_total || "",
        });
        api("/api/labels").then((d) => { if (!cancelled) setLabels(d); }).catch(() => {});
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
        spine_key: item.spine_key || "",
        side_key: item.side_key || "",
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

  const SLOT_LABELS = { image_key: "表表紙", spine_key: "背表紙", side_key: "裏表紙" };
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
    }, "表表紙");
  };

  /* 画像スロット（表表紙=image_key／背表紙=spine_key／裏表紙=side_key）の差し替え・削除 */
  const putItemKey = async (field, key, msg) => {
    if (!item || slotBusy) return;
    setSlotBusy(true);
    try {
      const updated = await apiJson(`/api/items/${item.id}`, "PUT", { ...item, [field]: key });
      setItem(updated);
      bumpItems();
      toast(msg);
    } catch (err) { toast(err.message); } finally { setSlotBusy(false); }
  };
  /* スロットの写真は全スロット共通で台形補正エディタ経由にする
     （エディタ側に「補正せずそのまま使う」もある） */
  const onSlotFile = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    const field = slotFieldRef.current;
    if (!f || !item || !field) return;
    openCoverEditor(f, (key) => putItemKey(field, key, `${SLOT_LABELS[field]}の画像を更新しました`), SLOT_LABELS[field]);
  };
  /* 登録済みの写真そのものに台形補正をかける */
  const editSlotImage = async (field, keyVal) => {
    if (!keyVal || slotBusy) return;
    setSlotBusy(true);
    try {
      const url = await apiImageObjectUrl(keyVal);
      const blob = await (await fetch(url)).blob();
      const f = new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });
      openCoverEditor(f, (key) => putItemKey(field, key, `${SLOT_LABELS[field]}を補正しました`), SLOT_LABELS[field]);
    } catch (err) {
      toast("画像の読み込みに失敗しました");
    } finally { setSlotBusy(false); }
  };
  const pickSlotFile = (field) => {
    slotFieldRef.current = field;
    if (slotFileRef.current) slotFileRef.current.click();
  };

  const links = item ? externalLinks(item) : [];

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
                {item.catno && <span className="badge badge-muted">品番 {item.catno}</span>}
                {item.edition && <span className="badge badge-muted">{item.edition}</span>}
                {item.price && <span className="badge badge-muted">{fmtPrice(item.price)}</span>}
                {item.location && <span className="badge badge-muted">保有場所: {item.location}</span>}
                {item.category && <span className="badge badge-muted">{item.category}</span>}
              </div>
              <h2>{item.title}</h2>
              <p className="muted">{item.creator || ""}</p>
              <p className="muted small">{item.publisher || ""}</p>
              {links.length > 0 && (
                <div className="ext-links" style={{ marginTop: 4, marginBottom: 10 }}>
                  {links.map((l) => (
                    <a key={l.label} className="ext-link" href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label} ↗
                    </a>
                  ))}
                </div>
              )}
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
                  <option value="magazine">雑誌</option>
                  <option value="other">その他</option>
                </select>
              </label>
              <label>進捗（現在）<input type="number" min="0" value={fields.prog_cur} onChange={set("prog_cur")} placeholder="182" /></label>
              <label>進捗（全体）<input type="number" min="0" value={fields.prog_total} onChange={set("prog_total")} placeholder="285" /></label>
              <label>タイトル<input type="text" value={fields.title} onChange={set("title")} required /></label>
              <label>著者 / アーティスト<input type="text" value={fields.creator} onChange={set("creator")} /></label>
              <label>出版社 / レーベル<input type="text" value={fields.publisher} onChange={set("publisher")} /></label>
              <label>ISBN / バーコード<input type="text" value={fields.isbn} onChange={set("isbn")} /></label>
              <label>規格品番（CD/DVD/BD）<input type="text" value={fields.catno} onChange={set("catno")} placeholder="例: VICL-12345" /></label>
              <label>版・仕様<input type="text" value={fields.edition} onChange={set("edition")} placeholder="例: 初回限定盤" /></label>
              <label>価格（円）<input type="text" inputMode="numeric" value={fields.price} onChange={set("price")} placeholder="例: 1650" /></label>
              <label>保有場所<input type="text" value={fields.location} onChange={set("location")} placeholder="例: 本棚 / Kindle" list="detail-locations" /></label>
              <label>カテゴリー<input type="text" value={fields.category} onChange={set("category")} placeholder="例: 小説 / ジャズ" list="detail-categories" /></label>
              <datalist id="detail-locations">
                {labels.locations.map((v) => <option key={v} value={v} />)}
              </datalist>
              <datalist id="detail-categories">
                {labels.categories.map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>
            <div className="row-gap">
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "保存中…" : "保存する"}</button>
              <button type="button" className="btn-danger" onClick={remove}>このアイテムを削除</button>
            </div>
          </form>

          <div className="divider" />
          <h3>画像</h3>
          <p className="muted small">表表紙・背表紙・裏表紙の写真は任意登録です。棚では背表紙→表表紙→裏表紙の順に使われます。未登録の場合は取得した表紙情報がそのまま使われます。</p>
          <div className="slot-grid">
            {[
              { field: "image_key", label: "表表紙", keyVal: item.image_key },
              { field: "spine_key", label: "背表紙", keyVal: item.spine_key },
              { field: "side_key", label: "裏表紙", keyVal: item.side_key },
            ].map((s) => (
              <div className="slot" key={s.field}>
                <div className="slot-label">{s.label}</div>
                <div className="slot-preview">
                  {s.keyVal ? (
                    <AuthedImage src={`/api/images/${encodeURIComponent(s.keyVal)}`} alt={s.label} />
                  ) : (
                    <span className="slot-empty">未登録</span>
                  )}
                </div>
                <div className="slot-actions">
                  <button type="button" className="btn-secondary" disabled={slotBusy} onClick={() => pickSlotFile(s.field)}>
                    {s.keyVal ? "差し替え" : "登録"}
                  </button>
                  {s.keyVal && (
                    <button type="button" className="btn-secondary" disabled={slotBusy} onClick={() => editSlotImage(s.field, s.keyVal)}>
                      台形補正
                    </button>
                  )}
                  {s.keyVal && (
                    <button type="button" className="btn-secondary" disabled={slotBusy} onClick={() => putItemKey(s.field, "", `${s.label}の画像を削除しました`)}>
                      削除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <input ref={slotFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onSlotFile} />

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
