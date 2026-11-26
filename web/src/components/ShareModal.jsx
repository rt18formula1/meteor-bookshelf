import React, { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { api, getPublicCollectionSettings, updateFolder, updatePublicCollectionSettings } from "../api.js";
import { useApp } from "../store.jsx";
import { downloadSharePdf, downloadSharePng, sharePng } from "../shareExport.js";

/* 投稿テンプレの既定値。{name}=フォルダ名または「本棚全体」、{count}=冊数、{url}=公開URL */
const DEFAULT_TEMPLATE = "📚 わたしの本棚の手帖「{name}」に {count} 冊！\n{url}\n#わたしの本棚の手帖 #読書記録";

/* 共有モーダル：フォルダ（または本棚全体）を画像・PDF・リンク・SNSで共有する。
   公開リンクは対象が公開中の場合だけ表示する。非公開の場合はここで公開にできる */
export default function ShareModal({ folder, onClose }) {
  const { toast, bumpFolders } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [publicState, setPublicState] = useState(folder ? !!folder.is_public : false);
  const [collectionState, setCollectionState] = useState({ is_public: false, share_id: "", url: "" });
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

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

  /* 本棚全体のときは公開設定を取得する（フォルダのときはフォルダの is_public を使う） */
  useEffect(() => {
    if (folder) return undefined;
    let cancelled = false;
    getPublicCollectionSettings()
      .then((d) => { if (!cancelled) setCollectionState(d); })
      .catch((e) => { if (!cancelled) toast(e.message); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder]);

  /* 公開中の場合だけ公開URLが入る。非公開の場合は空文字 */
  const shareUrl = folder
    ? (publicState ? `${window.location.origin}/s/${folder.share_id}` : "")
    : (collectionState.is_public ? collectionState.url : "");

  /* テンプレのプレースホルダを置換する。URLが無い場合は空行を詰める */
  const renderedText = template
    .replaceAll("{name}", targetName)
    .replaceAll("{count}", String(items.length))
    .replaceAll("{url}", shareUrl)
    .replace(/\n{2,}/g, "\n")
    .trim();

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      window.prompt("コピー", text);
      return false;
    }
  };

  const copyUrl = async () => {
    if (await copyText(shareUrl)) toast("共有URLをコピーしました");
  };

  const copyCaption = async () => {
    if (await copyText(renderedText)) toast("キャプションをコピーしました");
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

  const toggleCollectionPublic = async () => {
    try {
      const d = await updatePublicCollectionSettings({ is_public: !collectionState.is_public });
      setCollectionState(d);
      toast(d.is_public ? "本棚全体を公開しました。共有URLから誰でも見られます" : "本棚全体を非公開にしました");
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

  /* X：投稿画面を新しいタブで開く（画像は intent では添付できないため、隣のボタンでPNGを保存して手動で添付する） */
  const postToX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(renderedText)}`, "_blank", "noopener,noreferrer");
  };

  /* Instagram：ファイル共有に対応していれば共有シートを開く（ここからInstagramを選べる）。
     対応していなければPNGをダウンロードし、キャプションをコピーしてから案内する */
  const postToInstagram = async () => {
    if (busy || loading) return;
    setBusy("instagram");
    try {
      const result = await sharePng({ title: targetName, subtitle, items, text: renderedText });
      if (result === "shared") {
        await copyText(renderedText);
        toast("共有シートを開きました。キャプションもコピー済みです。Instagramを選んで投稿してください");
      } else if (result === "downloaded") {
        await copyText(renderedText);
        toast("画像をダウンロードし、キャプションをコピーしました。Instagramアプリで投稿してください");
      }
      /* cancelled（ユーザーが共有をやめた場合）は何もしない */
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
        <div className="share-public-box">
          <div className="row-gap" style={{ alignItems: "center" }}>
            <strong>{collectionState.is_public ? "公開中" : "非公開"}</strong>
            <span className="muted small">
              {collectionState.is_public
                ? "共有URLからログインなしで本棚全体が見られます"
                : "公開すると共有URLから本棚全体が誰でも見られるようになります"}
            </span>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn-secondary btn-small" onClick={toggleCollectionPublic}>
              {collectionState.is_public ? "非公開にする" : "公開する"}
            </button>
          </div>
          {collectionState.is_public && collectionState.url && (
            <div className="folder-share-url" style={{ marginTop: 8 }}>
              <code>{collectionState.url}</code>
              <button type="button" className="btn-secondary btn-small" onClick={copyUrl}>
                URLをコピー
              </button>
            </div>
          )}
        </div>
      )}

      <div className="sns-box">
        <h3>SNSで共有</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          投稿文のテンプレです。{"{name}"}は名前、{"{count}"}は冊数、{"{url}"}は公開URLに置き換わります。
          {!shareUrl && " 公開していないためURLは入りません。公開すると投稿にURLが入ります。"}
        </p>
        <textarea
          className="sns-template"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={4}
          aria-label="投稿文のテンプレ"
        />
        <div className="sns-buttons">
          <button type="button" className="btn-secondary btn-small" disabled={busy !== "" || loading} onClick={copyCaption}>
            キャプションをコピー
          </button>
          <button type="button" className="btn-secondary btn-small" disabled={busy !== "" || loading} onClick={postToX}>
            Xで投稿する
          </button>
          <button type="button" className="btn-secondary btn-small" disabled={busy !== "" || loading} onClick={() => run("png", () => downloadSharePng({ title: targetName, subtitle, items }))}>
            {busy === "png" ? "作成中…" : "画像を保存（PNG）"}
          </button>
          <button type="button" className="btn-secondary btn-small" disabled={busy !== "" || loading} onClick={postToInstagram}>
            {busy === "instagram" ? "共有中…" : "Instagramで投稿する"}
          </button>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Xでは画像を直接添付できないため、「画像を保存（PNG）」で保存した画像を投稿画面で添付してください。
          Instagramは共有シートから選んで投稿できます。非対応の端末では画像のダウンロードとキャプションのコピーを行います。
        </p>
      </div>

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
              text: `「${targetName}」 ${subtitle} — わたしの本棚の手帖`,
              url: shareUrl || undefined,
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
