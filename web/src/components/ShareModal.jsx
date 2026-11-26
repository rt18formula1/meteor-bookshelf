import React, { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { api, updateFolder } from "../api.js";
import { useApp } from "../store.jsx";
import { downloadSharePdf, downloadSharePng, sharePng } from "../shareExport.js";

/* 共有モーダル：フォルダ（または本棚全体）を画像・PDF・リンクで共有する。
   公開リンクはフォルダが公開中の場合だけ表示する。非公開の場合はここで公開にできる */
export default function ShareModal({ folder, onClose }) {
  const { toast, bumpFolders } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [publicState, setPublicState] = useState(folder ? !!folder.is_public : false);

  const targetName = folder ? folder.name : "本棚全体";
  const subtitle = `全${items.length}点`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ limit: 500, offset: 0, sort: "manual" });
        if (folder) qs.set("folder", String(folder.id));
        const data = await api(`/api/items?${qs}`);
        if (!cancelled) setItems(data.items || []);
      } catch (e) {
        if (!cancelled) toast(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder && folder.id]);

  const shareUrl = folder ? `${window.location.origin}/s/${folder.share_id}` : "";

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast("共有URLをコピーしました");
    } catch (_) {
      window.prompt("共有URL", shareUrl);
    }
  };

  const togglePublic = async () => {
    if (!folder) return;
    try {
      await updateFolder(folder.id, { is_public: !publicState });
      setPublicState(!publicState);
      toast(!publicState ? "公開しました。共有URLから誰でも見られます" : "非公開にしました");
      bumpFolders();
    } catch (e) {
      toast(e.message);
    }
  };

  const run = async (kind, fn) => {
    if (busy || loading) return;
    setBusy(kind);
    try {
      const result = await fn();
      if (result === "shared") toast("共有しました");
      else if (result === "downloaded") toast("ダウンロードしました");
      else if (result !== "cancelled") toast("保存しました");
    } catch (e) {
      toast(e.message || "共有に失敗しました");
    } finally {
      setBusy("");
    }
  };

  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <Modal onClose={onClose}>
      <h2>共有 — {targetName}</h2>
      <p className="muted small">
        {loading ? "読み込み中…" : `${subtitle}の本棚を共有します。画像・PDFはダウンロードしてSNSに投稿できます。`}
      </p>

      {folder && (
        <div className="share-public-box">
          <div className="row-gap" style={{ alignItems: "center" }}>
            <strong>{publicState ? "公開中" : "非公開"}</strong>
            <span className="muted small">
              {publicState
                ? "共有URLからログインなしで見られます"
                : "公開すると共有URLから誰でも見られるようになります"}
            </span>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn-secondary btn-small" onClick={togglePublic}>
              {publicState ? "非公開にする" : "公開する"}
            </button>
          </div>
          {publicState && (
            <div className="folder-share-url" style={{ marginTop: 8 }}>
              <code>{shareUrl}</code>
              <button type="button" className="btn-secondary btn-small" onClick={copyUrl}>
                URLをコピー
              </button>
            </div>
          )}
        </div>
      )}
      {!folder && (
        <p className="muted small">
          本棚全体の共有リンクはありません。フォルダごとに公開するとリンクで共有できます。
        </p>
      )}

      <div className="share-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={busy !== "" || loading}
          onClick={() => run("png", () => downloadSharePng({ title: targetName, subtitle, items }))}
        >
          {busy === "png" ? "作成中…" : "画像で保存（PNG）"}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy !== "" || loading}
          onClick={() => run("pdf", () => downloadSharePdf({ title: targetName, subtitle, items }))}
        >
          {busy === "pdf" ? "作成中…" : "PDFで保存"}
        </button>
        {canShare && (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy !== "" || loading}
            onClick={() => run("share", () => sharePng({
              title: targetName,
              subtitle,
              items,
              text: `「${targetName}」 ${subtitle} — 私の本棚`,
              url: folder && publicState ? shareUrl : undefined,
            }))}
          >
            {busy === "share" ? "共有中…" : "共有する"}
          </button>
        )}
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>
        画像・PDFはお使いの端末に保存されます。SNSへの投稿は保存したファイルから行ってください。
      </p>
      <div className="row-gap" style={{ marginTop: 8 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>閉じる</button>
      </div>
    </Modal>
  );
}
