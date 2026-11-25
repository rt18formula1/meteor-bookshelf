import React, { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { api, apiJson } from "../api.js";
import { useApp } from "../store.jsx";
import { IconCamera } from "./Icons.jsx";
import AuthedImage from "./AuthedImage.jsx";

const EMPTY = {
  type: "book", status: "unread", title: "", creator: "", publisher: "",
  isbn: "", catno: "", edition: "", price: "", location: "", category: "",
  cover_url: "", prog_cur: "", prog_total: "",
};

export default function ItemFormModal() {
  const { formPrefill, closeForm, openCoverEditor, toast, bumpItems, setView } = useApp();
  const [fields, setFields] = useState(EMPTY);
  const [imageKey, setImageKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [labels, setLabels] = useState({ locations: [], categories: [] });
  const fileRef = useRef(null);

  useEffect(() => {
    if (formPrefill) {
      setFields({
        type: formPrefill.type || "book",
        status: formPrefill.status || "unread",
        title: formPrefill.title || "",
        creator: formPrefill.creator || "",
        publisher: formPrefill.publisher || "",
        isbn: formPrefill.isbn || "",
        catno: formPrefill.catno || "",
        edition: formPrefill.edition || "",
        price: formPrefill.price != null ? String(formPrefill.price) : "",
        location: formPrefill.location || "",
        category: formPrefill.category || "",
        cover_url: formPrefill.cover_url || "",
        prog_cur: formPrefill.prog_cur ?? "",
        prog_total: formPrefill.prog_total ?? "",
      });
      setImageKey(formPrefill.image_key || "");
      /* 保有場所・カテゴリーの候補（取得できなければ通常のテキスト入力のまま） */
      api("/api/labels").then(setLabels).catch(() => {});
    }
  }, [formPrefill]);

  if (!formPrefill) return null;

  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));
  const previewUrl = imageKey ? `/api/images/${encodeURIComponent(imageKey)}` : fields.cover_url;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await apiJson("/api/items", "POST", {
        ...fields,
        image_key: imageKey,
        prog_cur: fields.prog_cur === "" ? 0 : parseInt(fields.prog_cur, 10) || 0,
        prog_total: fields.prog_total === "" ? 0 : parseInt(fields.prog_total, 10) || 0,
      });
      closeForm();
      toast("登録しました");
      bumpItems();
      setView("home");
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onPhotoSelected = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) openCoverEditor(f, (key) => setImageKey(key));
  };

  return (
    <Modal onClose={closeForm}>
      <h2>アイテムを登録</h2>
      {previewUrl && (
        <div className="form-cover-preview">
          <AuthedImage src={previewUrl} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
      )}
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>種別
            <select value={fields.type} onChange={set("type")}>
              <option value="book">書籍</option>
              <option value="cd">CD</option>
              <option value="dvd">DVD</option>
              <option value="other">その他</option>
            </select>
          </label>
          <label>状態
            <select value={fields.status} onChange={set("status")}>
              <option value="unread">未読 / 未視聴</option>
              <option value="reading">読み進め中 / 視聴中</option>
              <option value="done">読了 / 視聴済み</option>
            </select>
          </label>
          <label className="span2">タイトル<input type="text" value={fields.title} onChange={set("title")} required /></label>
          <label>著者 / アーティスト<input type="text" value={fields.creator} onChange={set("creator")} /></label>
          <label>出版社 / レーベル<input type="text" value={fields.publisher} onChange={set("publisher")} /></label>
          <label>ISBN / バーコード<input type="text" value={fields.isbn} onChange={set("isbn")} /></label>
          <label>規格品番（CD/DVD/BD）<input type="text" value={fields.catno} onChange={set("catno")} placeholder="例: VICL-12345" /></label>
          <label>版・仕様<input type="text" value={fields.edition} onChange={set("edition")} placeholder="例: 初回限定盤" /></label>
          <label>価格（円）<input type="text" inputMode="numeric" value={fields.price} onChange={set("price")} placeholder="例: 1650" /></label>
          <label>保有場所<input type="text" value={fields.location} onChange={set("location")} placeholder="例: 本棚 / Kindle" list="form-locations" /></label>
          <label>カテゴリー<input type="text" value={fields.category} onChange={set("category")} placeholder="例: 小説 / ジャズ" list="form-categories" /></label>
          <label>表紙画像URL<input type="text" value={fields.cover_url} onChange={set("cover_url")} placeholder="https://..." /></label>
          <datalist id="form-locations">
            {labels.locations.map((v) => <option key={v} value={v} />)}
          </datalist>
          <datalist id="form-categories">
            {labels.categories.map((v) => <option key={v} value={v} />)}
          </datalist>
          <label>進捗（現在）<input type="number" min="0" value={fields.prog_cur} onChange={set("prog_cur")} /></label>
          <label>進捗（全体）<input type="number" min="0" value={fields.prog_total} onChange={set("prog_total")} /></label>
        </div>
        <div className="row-gap wrap" style={{ marginBottom: 12 }}>
          <button type="button" className="btn-secondary" onClick={() => fileRef.current && fileRef.current.click()}>
            <IconCamera size={17} /> 表紙の写真を追加
          </button>
          {imageKey && <span className="muted small">写真を設定済み</span>}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPhotoSelected} />
        </div>
        <div className="row-gap">
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? "登録中…" : "登録する"}</button>
          <button type="button" className="btn-secondary" onClick={closeForm}>キャンセル</button>
        </div>
      </form>
    </Modal>
  );
}
