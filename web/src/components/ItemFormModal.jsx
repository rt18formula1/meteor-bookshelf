import React, { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { api, apiJson, listFolders, loadImageSize } from "../api.js";
import { useApp } from "../store.jsx";
import { FORMAT_OPTIONS, detectFormat, normalizeHeightMm } from "../utils.js";
import { IconCamera } from "./Icons.jsx";
import AuthedImage from "./AuthedImage.jsx";

const EMPTY = {
  type: "book", status: "unread", title: "", creator: "", publisher: "",
  isbn: "", catno: "", edition: "", price: "", location: "", category: "",
  folder_ids: [], cover_url: "", prog_cur: "", prog_total: "",
  format: "", height_mm: "",
};

export default function ItemFormModal() {
  const { formPrefill, closeForm, openCoverEditor, toast, bumpItems, setView } = useApp();
  const [fields, setFields] = useState(EMPTY);
  const [imageKey, setImageKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [labels, setLabels] = useState({ locations: [], categories: [] });
  const [folders, setFolders] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!formPrefill) return undefined;
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
      folder_ids: Array.isArray(formPrefill.folder_ids)
        ? formPrefill.folder_ids.map((v) => String(v))
        : (formPrefill.folder_id != null && formPrefill.folder_id !== "" ? [String(formPrefill.folder_id)] : []),
      cover_url: formPrefill.cover_url || "",
      prog_cur: formPrefill.prog_cur ?? "",
      prog_total: formPrefill.prog_total ?? "",
      /* 書誌検索で判明した高さ（mm）はそのまま入れる。判型は下の自動判別で補う */
      format: formPrefill.format || "",
      height_mm: formPrefill.height_mm != null && formPrefill.height_mm !== "" ? String(formPrefill.height_mm) : "",
    });
    setImageKey(formPrefill.image_key || "");
    let cancelled = false;
    /* 判型の自動判別：書誌の高さ（height_mm）と表紙画像の比率から推定する。
       書誌に判型がすでに入っている場合はそれを優先し、確実でない場合は未設定のままにする。
       表紙画像の比率は非同期で読むため、判別が終わった時点で未入力の場合だけ反映する */
    if ((formPrefill.type || "book") === "book" && !formPrefill.format) {
      const coverUrl = formPrefill.cover_url || "";
      const ratioP = coverUrl
        ? loadImageSize(coverUrl).then((s) => (s ? s.width / s.height : null)).catch(() => null)
        : Promise.resolve(null);
      ratioP.then((ratio) => {
        if (cancelled) return;
        const f = detectFormat(formPrefill.height_mm, ratio);
        if (f) setFields((prev) => (prev.format ? prev : { ...prev, format: f }));
      });
    }
    /* 保有場所・カテゴリーの候補（取得できなければ通常のテキスト入力のまま） */
    api("/api/labels").then((d) => { if (!cancelled) setLabels(d); }).catch(() => {});
    listFolders().then((d) => { if (!cancelled) setFolders(d.folders || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, [formPrefill]);

  if (!formPrefill) return null;

  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));
  /* フォルダの複数選択（チェックボックス）。未選択なら未分類 */
  const toggleFolder = (fid) => {
    const id = String(fid);
    setFields((f) => ({
      ...f,
      folder_ids: f.folder_ids.includes(id) ? f.folder_ids.filter((x) => x !== id) : [...f.folder_ids, id],
    }));
  };
  const previewUrl = imageKey ? `/api/images/${encodeURIComponent(imageKey)}` : fields.cover_url;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const folderIds = (fields.folder_ids || []).map((v) => parseInt(v, 10)).filter((n) => Number.isInteger(n) && n > 0);
      await apiJson("/api/items", "POST", {
        ...fields,
        folder_ids: folderIds,
        folder_id: folderIds.length ? folderIds[0] : null,
        image_key: imageKey,
        format: fields.type === "book" ? (fields.format || "") : "",
        height_mm: normalizeHeightMm(fields.height_mm),
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
    if (f) openCoverEditor(f, (key) => setImageKey(key), "表表紙");
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
              <option value="magazine">雑誌</option>
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
          <label>{fields.type === "magazine" ? "JANコード" : "ISBN / バーコード"}<input type="text" value={fields.isbn} onChange={set("isbn")} placeholder={fields.type === "magazine" ? "例: 4912123450660" : ""} /></label>
          <label>規格品番（CD/DVD/BD）<input type="text" value={fields.catno} onChange={set("catno")} placeholder="例: VICL-12345" /></label>
          <label>版・仕様<input type="text" value={fields.edition} onChange={set("edition")} placeholder="例: 初回限定盤" /></label>
          {fields.type === "book" && (
            <label>判型
              <select value={fields.format || ""} onChange={set("format")}>
                {FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          )}
          <label>高さ（mm）<input type="number" min="100" max="300" value={fields.height_mm} onChange={set("height_mm")} placeholder="例: 210（100〜300）" /></label>
          <label>価格（円）<input type="text" inputMode="numeric" value={fields.price} onChange={set("price")} placeholder="例: 1650" /></label>
          <label>保有場所<input type="text" value={fields.location} onChange={set("location")} placeholder="例: 本棚 / Kindle" list="form-locations" /></label>
          <label>カテゴリー<input type="text" value={fields.category} onChange={set("category")} placeholder="例: 小説 / ジャズ" list="form-categories" /></label>
          <div className="folder-field">フォルダ（複数選択可）
            <span className="folder-checks">
              {folders.length === 0 && <span className="muted small">フォルダがありません（未分類になります）</span>}
              {folders.map((f) => (
                <label key={f.id} className="folder-check">
                  <input
                    type="checkbox"
                    checked={(fields.folder_ids || []).includes(String(f.id))}
                    onChange={() => toggleFolder(f.id)}
                  />
                  {f.name}
                </label>
              ))}
            </span>
          </div>
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
