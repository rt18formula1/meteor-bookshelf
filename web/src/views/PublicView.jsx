import React, { useEffect, useState } from "react";
import { getPublicCollection, getPublicFolder, publicCoverSrc, publicSpineSrc } from "../api.js";
import { TYPE_LABEL, spineColor, spineTextColor } from "../utils.js";
import { IconBookLogo } from "../components/Icons.jsx";

/* 公開ページ（/s/:shareId＝フォルダ、/s/all/:shareId＝本棚全体）。ログイン不要・読み取り専用。
   App.jsx から認証チェックの前に表示される */
export default function PublicView() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const isCollection = parts[0] === "s" && parts[1] === "all";
  const shareId = (isCollection ? parts[2] : parts[1] || "").trim();
  const [state, setState] = useState({ loading: true, target: null, items: [], error: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = isCollection
          ? await getPublicCollection(shareId)
          : await getPublicFolder(shareId);
        if (!cancelled) {
          setState({
            loading: false,
            target: isCollection ? data.collection : data.folder,
            items: data.items || [],
            error: "",
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState({ loading: false, target: null, items: [], error: "このページは存在しないか、非公開です" });
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  if (state.loading) {
    return (
      <div className="boot-screen">
        <IconBookLogo size={40} />
        <p className="muted">読み込み中…</p>
      </div>
    );
  }

  if (state.error || !state.target) {
    return (
      <div className="public-page">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <IconBookLogo size={24} />
              <span>わたしの本棚の手帖</span>
            </div>
          </div>
        </header>
        <main className="main">
          <section className="view">
            <p className="empty-text">{state.error}</p>
            <p className="muted small">共有URLが間違っているか、{isCollection ? "本棚全体" : "フォルダ"}が非公開になっている可能性があります。</p>
            <a className="btn-secondary btn-small" href="/lp">わたしの本棚の手帖について</a>
          </section>
        </main>
      </div>
    );
  }

  const { target, items } = state;
  return (
    <div className="public-page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <IconBookLogo size={24} />
            <span>わたしの本棚の手帖</span>
          </div>
          <div className="topbar-actions">
            <a className="btn-secondary btn-small" href="/lp">アプリを見る</a>
          </div>
        </div>
      </header>
      <main className="main">
        <section className="view">
          <p className="hero-eyebrow">共有された本棚</p>
          <h1 className="hero-title">{target.name}</h1>
          <p className="muted">全{target.item_count}点</p>
          {items.length === 0 ? (
            <p className="empty-text">{isCollection ? "この本棚にはまだアイテムがありません。" : "このフォルダにはまだアイテムがありません。"}</p>
          ) : (
            <div className="public-grid">
              {items.map((item) => {
                /* 本棚全体では棚と同じ優先順位（背表紙→表表紙→裏表紙→外部表紙）で画像を選ぶ */
                const src = isCollection ? publicSpineSrc(item) : publicCoverSrc(item);
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
            この本棚は「わたしの本棚の手帖」で作られました。
          </p>
        </section>
      </main>
    </div>
  );
}
