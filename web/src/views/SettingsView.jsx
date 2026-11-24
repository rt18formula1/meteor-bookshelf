import React, { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";
import { api, downloadCsv } from "../api.js";
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
      <div className="card">
        <h3>データのエクスポート</h3>
        <p className="muted small">自分の棚の全アイテムをCSVでダウンロードできます。Excelで日本語が文字化けしない形式です。</p>
        <button className="btn-secondary" onClick={exportAll}>
          <IconDownload size={16} /> CSVでダウンロード
        </button>
      </div>
      <div className="card">
        <h3>このアプリについて</h3>
        <p className="muted small">私の本棚 — Bookshelf。書籍・CD・DVD等を木の本棚のメタファーで管理する小規模公開アプリです。書誌情報の取得には OpenBD / Google Books / NDLサーチ / MusicBrainz を利用しています。</p>
      </div>
    </section>
  );
}
