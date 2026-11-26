import React, { useEffect, useState } from "react";
import { signOut, GoogleAuthProvider, reauthenticateWithPopup, linkWithPopup } from "firebase/auth";
import { auth } from "../firebase.js";
import { api, apiJson, downloadCsv, downloadXlsx } from "../api.js";
import { useApp } from "../store.jsx";
import { IconDownload } from "../components/Icons.jsx";

/* 全件をページング取得して統計を集計する（小規模公開前提） */
async function fetchAllItems() {
  const all = [];
  let offset = 0;
  for (;;) {
    const qs = new URLSearchParams({ limit: 100, offset });
    const data = await api(`/api/items?${qs}`);
    all.push(...data.items);
    offset = all.length;
    if (all.length >= data.total || data.items.length === 0 || all.length >= 5000) break;
  }
  return all;
}

/* サブスクリプション（エクスポートプラン）の表示用ヘルパー */
const SUB_SOURCE_LABEL = { stripe: "Stripe", code: "コード", admin: "管理者付与" };
const SUB_UNLIMITED_END = 4102444800; // 2100-01-01 UTC。これ以上は「無期限」
function fmtSubDate(ts) {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function subStatusText(sub) {
  if (!sub) return "読み込み中…";
  if (sub.is_admin) return "管理者アカウント（常時有効）";
  if (!sub.active) return "未加入";
  const src = SUB_SOURCE_LABEL[sub.source] || sub.source || "";
  if (sub.unlimited || (sub.period_end || 0) >= SUB_UNLIMITED_END) {
    return `有効（無期限${src ? `・取得方法: ${src}` : ""}）`;
  }
  return `有効（${fmtSubDate(sub.period_end)} まで${src ? `・取得方法: ${src}` : ""}）`;
}

/* エクスポートプラン（サブスクリプション）カード。
   コードの有効化と Stripe 決済への導線。状態は親が /api/settings から渡す。 */
function PlanCard({ subscription, onChanged }) {
  const { toast } = useApp();
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState(null); // { ok, message }
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutMsg, setCheckoutMsg] = useState("");

  const redeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    setRedeemResult(null);
    try {
      const r = await apiJson("/api/license/redeem", "POST", { code: code.trim() });
      if (r.ok) {
        setRedeemResult({ ok: true, message: "コードを有効化しました" });
        setCode("");
        toast("エクスポートプランを有効化しました");
        if (onChanged) onChanged();
      } else {
        setRedeemResult({ ok: false, message: r.error || "コードが無効です" });
      }
    } catch (e) {
      setRedeemResult({ ok: false, message: e.message });
    } finally {
      setRedeeming(false);
    }
  };

  const checkout = async () => {
    setCheckingOut(true);
    setCheckoutMsg("");
    try {
      const r = await apiJson("/api/billing/checkout", "POST", {});
      if (r.ok && r.url) {
        window.location.href = r.url;
        return;
      }
      if (r.code === "stripe_not_configured") {
        setCheckoutMsg("決済は準備中です。コードをお持ちの方は上から有効化できます");
      } else {
        setCheckoutMsg(r.error || "決済を開始できませんでした");
      }
    } catch (e) {
      setCheckoutMsg(e.message);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="card">
      <h3>エクスポートプラン</h3>
      <p className="small">
        状態: <strong>{subStatusText(subscription)}</strong>
      </p>
      <p className="muted small">
        外部へのエクスポート（CSV / Excel のダウンロード、Google スプレッドシート書き出し、Notion 連携の実行）は有料プランでご利用いただけます。それ以外の機能はすべて無料です。
        期限が切れると書き出し・Notion 同期は止まりますが、書き出し済みのファイルや Notion のページはそのまま残ります。
      </p>
      <label>
        アクティベーションコード
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="MBSH-XXXXXX-XXXXXX-XXXXXX"
          autoComplete="off"
        />
      </label>
      <div className="row-gap wrap">
        <button className="btn-primary" onClick={redeem} disabled={redeeming || !code.trim()}>
          {redeeming ? "確認中…" : "有効化する"}
        </button>
        <button className="btn-secondary" onClick={checkout} disabled={checkingOut}>
          {checkingOut ? "決済画面へ移動中…" : "サブスクリプションに登録する"}
        </button>
      </div>
      {redeemResult && (
        <p className="small" style={{ marginTop: 10, color: redeemResult.ok ? "#2e6b2e" : "#b03030" }}>
          {redeemResult.message}
        </p>
      )}
      {checkoutMsg && (
        <p className="small" style={{ marginTop: 10, color: "#b03030" }}>
          {checkoutMsg}
        </p>
      )}
    </div>
  );
}

/* Notion 連携設定カード。
   トークンはサーバーに保存されるだけで、画面には再表示されない（設定済みかどうかだけ分かる）。 */
function NotionCard({ subActive }) {
  const { toast } = useApp();
  const [loaded, setLoaded] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [dbId, setDbId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message }
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // { ok, message }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api("/api/settings");
        if (cancelled) return;
        setHasToken(!!s.has_notion_token);
        setDbId(s.notion_db_id || "");
        setEnabled(!!s.notion_enabled);
      } catch (_) {}
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const body = { notion_db_id: dbId, notion_enabled: enabled };
      if (tokenInput.trim()) body.notion_token = tokenInput.trim();
      const s = await apiJson("/api/settings", "PUT", body);
      setHasToken(!!s.has_notion_token);
      setDbId(s.notion_db_id || "");
      setEnabled(!!s.notion_enabled);
      setTokenInput("");
      toast("Notion連携の設定を保存しました");
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const clearToken = async () => {
    setSaving(true);
    try {
      const s = await apiJson("/api/settings", "PUT", { clear_notion_token: true });
      setHasToken(!!s.has_notion_token);
      setTokenInput("");
      toast("トークンを削除しました");
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const body = { notion_db_id: dbId };
      if (tokenInput.trim()) body.notion_token = tokenInput.trim();
      const r = await apiJson("/api/notion/test", "POST", body);
      if (r.ok) {
        let message = `接続できました（データベース: ${r.database_title || "（名称なし）"}）`;
        if (r.resolved_database_id) {
          setDbId(r.resolved_database_id);
          message += "。入力された ID はデータソースの ID でしたので、正しいデータベース ID に置き換えました。このまま「保存」を押してください";
        }
        setTestResult({ ok: true, message });
      }
      else setTestResult({ ok: false, message: `接続できませんでした: ${r.error || "不明なエラー"}` });
    } catch (e) {
      setTestResult({ ok: false, message: `接続できませんでした: ${e.message}` });
    } finally {
      setTesting(false);
    }
  };

  const syncAll = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await apiJson("/api/notion/sync-all", "POST", {});
      if (r.ok) {
        let message = `Notion へ同期しました（新規 ${r.created} 件・更新 ${r.updated} 件${r.failed ? `・失敗 ${r.failed} 件` : ""}）`;
        if (r.remaining > 0) message += `。残り ${r.remaining} 件がありますので、もう一度押してください`;
        if (r.total === 0) message = "同期するアイテムがありませんでした";
        setSyncResult({ ok: r.failed === 0, message });
      } else {
        setSyncResult({ ok: false, message: `同期できませんでした: ${r.error || "不明なエラー"}` });
      }
    } catch (e) {
      setSyncResult({ ok: false, message: `同期できませんでした: ${e.message}` });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="card">
      <h3>Notion連携</h3>
      <p className="muted small">
        アプリでアイテムを追加・変更・削除すると、Notion のデータベースにも自動で反映されます（アプリ → Notion の一方向同期）。
        Notion 側のプロパティ名（作者・出版社・ISBN・規格品番・カテゴリー・保有場所・種別・状態・価格・登録日など）に合わせて値が入ります。
      </p>
      <ol className="muted small" style={{ paddingLeft: 20, margin: "8px 0 12px" }}>
        <li>notion.so/my-integrations でインテグレーションを作成し、トークンをコピーします</li>
        <li>連携先データベースの「•••」メニュー →「コネクトの追加」で、そのインテグレーションを接続します</li>
        <li>データベースの ID（URL に含まれる 32 桁の文字列）を下に貼り付けます</li>
      </ol>
      <label>
        インテグレーショントークン
        {hasToken && <span className="badge badge-muted" style={{ marginLeft: 8 }}>設定済み</span>}
        <input
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder={hasToken ? "変更する場合のみ入力してください" : "secret_... / ntn_..."}
          autoComplete="off"
          disabled={!loaded}
        />
      </label>
      <label>
        データベース ID
        <input
          type="text"
          value={dbId}
          onChange={(e) => setDbId(e.target.value)}
          placeholder="例: 0123456789abcdef0123456789abcdef"
          autoComplete="off"
          disabled={!loaded}
        />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ width: "auto", margin: 0 }}
          disabled={!loaded}
        />
        Notion連携を有効にする
      </label>
      {subActive === false && (
        <p className="small" style={{ color: "#b03030", margin: "4px 0 8px" }}>
          Notion 同期の実行にはエクスポートプラン（有料）が必要です。接続テストは無料でご利用いただけます。
        </p>
      )}
      <div className="row-gap wrap">
        <button className="btn-primary" onClick={save} disabled={!loaded || saving}>
          {saving ? "保存中…" : "保存"}
        </button>
        <button className="btn-secondary" onClick={test} disabled={!loaded || testing}>
          {testing ? "接続テスト中…" : "接続テスト"}
        </button>
        {hasToken && (
          <button className="btn-secondary" onClick={clearToken} disabled={!loaded || saving}>
            トークンを削除
          </button>
        )}
      </div>
      {testResult && (
        <p className="small" style={{ marginTop: 10, color: testResult.ok ? "#2e6b2e" : "#b03030" }}>
          {testResult.message}
        </p>
      )}
      {hasToken && dbId && (
        <div style={{ marginTop: 14, borderTop: "1px solid #e8dcc8", paddingTop: 12 }}>
          <p className="muted small" style={{ margin: "0 0 8px" }}>
            連携する前に登録したアイテムは自動では送られません。下のボタンで、登録済みの全アイテムを Notion へまとめて送れます。
          </p>
          <button className="btn-primary" onClick={syncAll} disabled={!loaded || syncing}>
            {syncing ? "Notion へ同期中…" : "登録済みアイテムを Notion へ一括同期"}
          </button>
          {syncResult && (
            <p className="small" style={{ marginTop: 10, color: syncResult.ok ? "#2e6b2e" : "#b03030" }}>
              {syncResult.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsView() {
  const { user, toast } = useApp();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await fetchAllItems();
        if (cancelled) return;
        const by = (fn) => all.filter(fn).length;
        setStats({
          total: all.length,
          book: by((i) => i.type === "book"),
          cd: by((i) => i.type === "cd"),
          dvd: by((i) => i.type === "dvd"),
          other: by((i) => i.type === "other"),
          done: by((i) => i.status === "done"),
          reading: by((i) => i.status === "reading"),
          unread: by((i) => i.status === "unread"),
        });
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const exportAll = async () => {
    try {
      await downloadCsv({});
      toast("CSVをダウンロードしました");
    } catch (e) {
      toast(e.message);
    }
  };

  const [xlsxBusy, setXlsxBusy] = useState(false);
  const exportXlsx = async () => {
    setXlsxBusy(true);
    try {
      await downloadXlsx({});
      toast("Excelファイルをダウンロードしました");
    } catch (e) {
      toast(e.message);
    } finally {
      setXlsxBusy(false);
    }
  };

  const [sheetsBusy, setSheetsBusy] = useState(false);
  const [sheetsResult, setSheetsResult] = useState(null); // { ok, message, url }
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [subscription, setSubscription] = useState(null);

  const reloadSettings = async () => {
    try {
      const s = await api("/api/settings");
      if (s.sheets_url) setSheetsUrl(s.sheets_url);
      setSubscription(s.subscription || null);
    } catch (_) {}
  };

  useEffect(() => {
    reloadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Google 承認ポップアップで Sheets 用のアクセストークンを取得し、
     サーバー経由でスプレッドシートへ全件書き出す。トークンは保存しない。 */
  const exportSheets = async () => {
    setSheetsBusy(true);
    setSheetsResult(null);
    try {
      const cu = auth.currentUser;
      if (!cu) throw new Error("ログイン状態を確認できませんでした");
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/spreadsheets");
      provider.addScope("https://www.googleapis.com/auth/drive.file");
      const isGoogle = cu.providerData.some((p) => p.providerId === "google.com");
      const result = isGoogle ? await reauthenticateWithPopup(cu, provider) : await linkWithPopup(cu, provider);
      const cred = GoogleAuthProvider.credentialFromResult(result);
      if (!cred || !cred.accessToken) throw new Error("Google の承認が取得できませんでした");
      const r = await apiJson("/api/sheets/export", "POST", { access_token: cred.accessToken });
      if (r.ok) {
        setSheetsUrl(r.url || "");
        setSheetsResult({ ok: true, message: `${r.count} 件を Google スプレッドシートへ書き出しました`, url: r.url || "" });
      } else {
        setSheetsResult({ ok: false, message: r.error || "不明なエラー" });
      }
    } catch (e) {
      let msg = e.message || String(e);
      if (e.code === "auth/popup-closed-by-user") msg = "Google の承認がキャンセルされました";
      else if (e.code === "auth/popup-blocked") msg = "ポップアップがブロックされました。ブラウザのポップアップ許可をご確認ください";
      else if (e.code === "auth/credential-already-in-use" || e.code === "auth/email-already-in-use") msg = "この Google アカウントは別のユーザーに紐付いています。Google ログインでお使いのアカウントでお試しください";
      setSheetsResult({ ok: false, message: msg });
    } finally {
      setSheetsBusy(false);
    }
  };

  return (
    <section className="view">
      <h2 className="view-title">設定</h2>
      <div className="card">
        <h3>アカウント</h3>
        <p>ログイン中: <strong>{user ? user.email : ""}</strong></p>
        {stats && (
          <div className="stats">
            <span className="badge">すべて {stats.total}</span>
            <span className="badge badge-muted">書籍 {stats.book}</span>
            <span className="badge badge-muted">CD {stats.cd}</span>
            <span className="badge badge-muted">DVD {stats.dvd}</span>
            <span className="badge badge-muted">その他 {stats.other}</span>
            <span className="badge badge-muted">読了 {stats.done}</span>
            <span className="badge badge-muted">進行中 {stats.reading}</span>
            <span className="badge badge-muted">未読 {stats.unread}</span>
          </div>
        )}
        {/* ログアウトは Firebase Auth の signOut（成功時はログイン画面へ自動で切り替わる） */}
        <button
          className="btn-secondary"
          onClick={async () => {
            try {
              await signOut(auth);
            } catch (_) {
              toast("ログアウトに失敗しました");
            }
          }}
        >
          ログアウト
        </button>
      </div>
      <PlanCard subscription={subscription} onChanged={reloadSettings} />
      <NotionCard subActive={subscription ? subscription.active : undefined} />
      <div className="card">
        <h3>データのエクスポート</h3>
        <p className="muted small">自分の棚の全アイテムを、CSV / Excel ファイルでダウンロードしたり、Google スプレッドシートへ書き出したりできます。</p>
        {subscription && !subscription.active && (
          <p className="small" style={{ color: "#b03030" }}>
            <span className="badge" style={{ marginRight: 6 }}>有料プランが必要</span>
            エクスポート機能のご利用にはエクスポートプランへの加入が必要です。
          </p>
        )}
        <div className="row-gap wrap">
          <button className="btn-secondary" onClick={exportAll}>
            <IconDownload size={16} /> CSVでダウンロード
          </button>
          <button className="btn-secondary" onClick={exportXlsx} disabled={xlsxBusy}>
            <IconDownload size={16} /> {xlsxBusy ? "Excelを作成中…" : "Excel（.xlsx）でダウンロード"}
          </button>
          <button className="btn-secondary" onClick={exportSheets} disabled={sheetsBusy}>
            {sheetsBusy ? "書き出し中…" : "Google スプレッドシートへ書き出す"}
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>
          スプレッドシートへ書き出す際は Google の承認画面が開きます。初回は新しいシートを作成し、次回からは同じシートを最新の一覧で書き換えます。
          {sheetsUrl && (<> <a href={sheetsUrl} target="_blank" rel="noreferrer">前回のシートを開く</a></>)}
        </p>
        {sheetsResult && (
          <p className="small" style={{ color: sheetsResult.ok ? "#2e6b2e" : "#b03030" }}>
            {sheetsResult.message}
            {sheetsResult.ok && sheetsResult.url && (<> <a href={sheetsResult.url} target="_blank" rel="noreferrer">シートを開く</a></>)}
          </p>
        )}
      </div>
      {user && String(user.email || "").toLowerCase() === "rb18vcarb@gmail.com" && (
        <div className="card">
          <h3>管理</h3>
          <p className="muted small">ユーザーとアクティベーションコードの管理画面です（管理者アカウントでのみ表示されます）。</p>
          <a className="btn-secondary" href="/admin" style={{ display: "inline-block", textDecoration: "none" }}>
            管理画面を開く（/admin）
          </a>
        </div>
      )}
      <div className="card">
        <h3>このアプリについて</h3>
        <p className="muted small">わたしの本棚の手帖 — Bookshelf。書籍・CD・DVD等を木の本棚のメタファーで管理する小規模公開アプリです。書誌情報の取得には OpenBD / Google Books / NDLサーチ / MusicBrainz を利用しています。</p>
        <p className="app-credit">© Meteor Creator Studio</p>
      </div>
    </section>
  );
}
