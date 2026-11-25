import React, { useCallback, useEffect, useState } from "react";
import { api, apiJson } from "../api.js";
import { useApp } from "../store.jsx";

/* 管理画面（/admin）。管理者メールでログインしている場合のみ API が応答する。
   ユーザーの権利付与・停止と、アクティベーションコードの発行・失効を行う。 */

const UNLIMITED_END = 4102444800; // 2100-01-01 UTC。これ以上は「無期限」
const SOURCE_LABEL = { stripe: "Stripe", code: "コード", admin: "管理者付与" };

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function fmtPeriodEnd(ts, now) {
  if (!ts) return "なし";
  if (ts >= UNLIMITED_END) return "無期限";
  return `${fmtDate(ts)} まで${ts <= now ? "（期限切れ）" : ""}`;
}

const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle = { textAlign: "left", padding: "6px 8px", borderBottom: "2px solid #e8dcc8", whiteSpace: "nowrap" };
const tdStyle = { padding: "6px 8px", borderBottom: "1px solid #efe6d6", verticalAlign: "top" };
const smallBtn = { padding: "3px 10px", fontSize: 12 };

export default function AdminView() {
  const { user, toast } = useApp();
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [users, setUsers] = useState(null);
  const [codes, setCodes] = useState(null);
  const [busyKey, setBusyKey] = useState("");

  /* コード発行フォーム */
  const [count, setCount] = useState(1);
  const [preset, setPreset] = useState("30"); // 30 | 90 | 365 | unlimited | custom
  const [customDays, setCustomDays] = useState(180);
  const [note, setNote] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issuedCodes, setIssuedCodes] = useState(null); // 平文コード（この画面でのみ表示）

  const now = Math.floor(Date.now() / 1000);

  const load = useCallback(async () => {
    try {
      const [u, c] = await Promise.all([api("/api/admin/users"), api("/api/admin/codes")]);
      setUsers(u.users || []);
      setCodes(c.codes || []);
      setForbidden(false);
      setLoadError("");
    } catch (e) {
      if (String(e.message || "").includes("権限")) setForbidden(true);
      else setLoadError(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grant = async (target, body, label) => {
    setBusyKey(`grant-${target.id}-${label}`);
    try {
      await apiJson(`/api/admin/users/${target.id}/grant`, "POST", body);
      toast(`${target.email} に${label}を付与しました`);
      await load();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusyKey("");
    }
  };

  const revokeSub = async (target) => {
    setBusyKey(`revoke-${target.id}`);
    try {
      await apiJson(`/api/admin/users/${target.id}/revoke-sub`, "POST", {});
      toast(`${target.email} の権利を停止しました`);
      await load();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusyKey("");
    }
  };

  const issue = async () => {
    setIssuing(true);
    setIssuedCodes(null);
    try {
      const body = { count: Number(count) || 1, note };
      if (preset === "unlimited") body.unlimited = true;
      else body.duration_days = preset === "custom" ? Number(customDays) || 0 : parseInt(preset);
      const r = await apiJson("/api/admin/codes", "POST", body);
      if (r.ok && Array.isArray(r.codes)) {
        setIssuedCodes(r.codes);
        toast(`${r.codes.length} 件のコードを発行しました`);
        await load();
      } else {
        toast(r.error || "発行に失敗しました");
      }
    } catch (e) {
      toast(e.message);
    } finally {
      setIssuing(false);
    }
  };

  const copyIssued = async () => {
    if (!issuedCodes) return;
    try {
      await navigator.clipboard.writeText(issuedCodes.join("\n"));
      toast("コードをコピーしました");
    } catch (_) {
      toast("コピーできませんでした。下の欄から手動でコピーしてください");
    }
  };

  const revokeCode = async (c) => {
    setBusyKey(`code-${c.id}`);
    try {
      await apiJson(`/api/admin/codes/${c.id}/revoke`, "POST", {});
      toast("コードを失効しました");
      await load();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "16px 14px 48px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>管理画面 — 私の本棚</h2>
        <a href="/" className="btn-secondary" style={{ textDecoration: "none" }}>アプリに戻る</a>
      </header>
      <p className="muted small">ログイン中: {user ? user.email : ""}</p>

      {forbidden ? (
        <div className="card">
          <h3>権限がありません</h3>
          <p className="muted small">この画面は管理者アカウントでのみご利用いただけます。</p>
        </div>
      ) : loadError ? (
        <div className="card">
          <h3>読み込めませんでした</h3>
          <p className="small" style={{ color: "#b03030" }}>{loadError}</p>
          <button className="btn-secondary" onClick={load}>再読み込み</button>
        </div>
      ) : (
        <>
          <div className="card">
            <h3>ユーザー一覧</h3>
            {users === null ? (
              <p className="muted small">読み込み中…</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>メール</th>
                      <th style={thStyle}>権利状態</th>
                      <th style={thStyle}>取得方法</th>
                      <th style={thStyle}>アイテム数</th>
                      <th style={thStyle}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const active = (u.sub_period_end || 0) > now;
                      return (
                        <tr key={u.id}>
                          <td style={tdStyle}>{u.email}</td>
                          <td style={tdStyle}>{active ? `有効（${fmtPeriodEnd(u.sub_period_end, now)}）` : "なし"}</td>
                          <td style={tdStyle}>{u.sub_source ? SOURCE_LABEL[u.sub_source] || u.sub_source : "—"}</td>
                          <td style={tdStyle}>{u.item_count}</td>
                          <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                            <button className="btn-secondary" style={smallBtn} disabled={!!busyKey} onClick={() => grant(u, { days: 30 }, "30日")}>+30日</button>{" "}
                            <button className="btn-secondary" style={smallBtn} disabled={!!busyKey} onClick={() => grant(u, { days: 365 }, "365日")}>+365日</button>{" "}
                            <button className="btn-secondary" style={smallBtn} disabled={!!busyKey} onClick={() => grant(u, { unlimited: true }, "無期限")}>無期限</button>{" "}
                            <button className="btn-danger" style={smallBtn} disabled={!!busyKey} onClick={() => revokeSub(u)}>停止</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h3>アクティベーションコード発行</h3>
            <p className="muted small">
              友人への配布などに使うコードを発行します。平文コードは発行直後のこの画面にだけ表示され、データベースにはハッシュしか残りません。忘れずに控えてください。
            </p>
            <div className="row-gap wrap" style={{ alignItems: "flex-end" }}>
              <label style={{ margin: 0 }}>
                個数
                <input type="number" min="1" max="100" value={count} onChange={(e) => setCount(e.target.value)} style={{ width: 90 }} />
              </label>
              <label style={{ margin: 0 }}>
                期間
                <select value={preset} onChange={(e) => setPreset(e.target.value)} style={{ width: 140 }}>
                  <option value="30">30日</option>
                  <option value="90">90日</option>
                  <option value="365">365日</option>
                  <option value="unlimited">無期限</option>
                  <option value="custom">日数を指定</option>
                </select>
              </label>
              {preset === "custom" && (
                <label style={{ margin: 0 }}>
                  日数
                  <input type="number" min="1" max="3650" value={customDays} onChange={(e) => setCustomDays(e.target.value)} style={{ width: 110 }} />
                </label>
              )}
              <label style={{ margin: 0, flex: "1 1 200px" }}>
                メモ（配布先など）
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例: ○○さんへ" />
              </label>
              <button className="btn-primary" onClick={issue} disabled={issuing}>
                {issuing ? "発行中…" : "発行する"}
              </button>
            </div>
            {issuedCodes && (
              <div style={{ marginTop: 12 }}>
                <p className="small" style={{ color: "#2e6b2e", margin: "0 0 6px" }}>
                  発行しました（この一覧は再表示できません）:
                </p>
                <textarea readOnly value={issuedCodes.join("\n")} rows={Math.min(issuedCodes.length + 1, 12)} style={{ width: "100%", fontFamily: "monospace" }} />
                <button className="btn-secondary" onClick={copyIssued}>コードをコピー</button>
              </div>
            )}
          </div>

          <div className="card">
            <h3>コード一覧</h3>
            {codes === null ? (
              <p className="muted small">読み込み中…</p>
            ) : codes.length === 0 ? (
              <p className="muted small">まだコードは発行されていません。</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>コード（末尾4文字）</th>
                      <th style={thStyle}>期間</th>
                      <th style={thStyle}>メモ</th>
                      <th style={thStyle}>状態</th>
                      <th style={thStyle}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((c) => {
                      const status = c.revoked
                        ? "失効"
                        : c.redeemed_by_email
                          ? `使用済み（${c.redeemed_by_email}・${fmtDate(c.redeemed_at)}）`
                          : "未使用";
                      return (
                        <tr key={c.id}>
                          <td style={{ ...tdStyle, fontFamily: "monospace" }}>…{c.code_hint}</td>
                          <td style={tdStyle}>{c.duration_days === null || c.duration_days === undefined ? "無期限" : `${c.duration_days}日`}</td>
                          <td style={tdStyle}>{c.note || "—"}</td>
                          <td style={tdStyle}>{status}</td>
                          <td style={tdStyle}>
                            {!c.revoked && !c.redeemed_by_email && (
                              <button className="btn-danger" style={smallBtn} disabled={!!busyKey} onClick={() => revokeCode(c)}>失効</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
