import React, { useEffect, useState } from "react";
import { getPublicFolder, publicCoverSrc } from "../api.js";
import { TYPE_LABEL, spineColor, spineTextColor } from "../utils.js";
import { IconBookLogo } from "../components/Icons.jsx";

/* 公開ページ（/s/:shareId）。ログイン不要・読み取り専用。
   App.jsx から認証チェックの前に表示される */
export default function PublicView() {
  const shareId = (window.location.pathname.split("/")[2] || "").trim();
  const [state, setState] = useState({ loading: true, folder: null, items: [], error: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPublicFolder(shareId);
        if (!cancelled) setState({ loading: false, folder: data.folder, items: data.items || [], error: "" });
      } catch (e) {
        if (!cancelled) {
          setState({ loading: false, folder: null, items: [], error: "このページは存在しないか、非公開です" });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [shareId]);

  if (state.loading) {
    return (
      <div className="boot-screen">
        <IconBookLogo size={40} />
        <p className="muted">読み込み中…</p>
      </div>
    );
  }

  if (state.error || !state.folder) {
    return (
      <div className="public-page">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <IconBookLogo size={24} />
              <span>私の本棚</span>
            </div>
          </div>
        </header>
        <main className="main">
          <section className="view">
            <p className="empty-text">{state.error}</p>
            <p className="muted small">共有URLが間違っているか、フォルダが非公開になっている可能性があります。</p>
            <a className="btn-secondary btn-small" href="/lp">私の本棚について</a>
          </section>
        </main>
      </div>
    );
  }

  const { folder, items } = state;
  return (
    <div className="public-page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <IconBookLogo size={24} />
            <span>私の本棚</span>
          </div>
          <div className="topbar-actions">
            <a className="btn-secondary btn-small" href="/lp">アプリを見る</a>
          </div>
        </div>
      </header>
      <main className="main">
        <section className="view">
          <p className="hero-eyebrow">共有された本棚</p>
          <h1 className="hero-title">{folder.name}</h1>
          <p className="muted">全{folder.item_count}点</p>
          {items.length === 0 ? (
            <p className="empty-text">このフォルダにはまだアイテムがありません。</p>
          ) : (
            <div className="public-grid">
              {items.map((item) => {
                const src = publicCoverSrc(item);
                return (
                  <div className="public-card" key={item.id}>
                    <div className="public-cover">
                      {src ? (
                        <img src={src} alt={item.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : (
                        <span
                          className="public-cover-gen"
                          style={{ background: spineColor(item), color: spineTextColor(item) }}
                        >
                          {(item.title || "?").slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="public-info">
                      <span className="badge">{TYPE_LABEL[item.type] || "その他"}</span>
                      <div className="public-title">{item.title}</div>
                      {item.creator && <div className="muted small">{item.creator}</div>}
                      {item.publisher && <div className="muted small">{item.publisher}</div>}
                      {item.price && <div className="muted small">{item.price}円</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="muted small" style={{ marginTop: 24 }}>
            この本棚は「私の本棚」で作られました。
          </p>
        </section>
      </main>
    </div>
  );
}
