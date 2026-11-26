import React from "react";

/* 公開プロモーションページ（/lp）。ログイン不要で表示する単独ページ。
   デザインはアプリ本体（Gesso「Cinematic 3」）に合わせる。 */
const FEATURES = [
  { title: "スキャンで自動登録", body: "バーコードや ISBN、CD の規格品番を読み取るだけで、書誌・ディスク情報を自動で取得。手入力の手間を減らします。" },
  { title: "本棚ビュー", body: "登録したアイテムが、木の棚に背表紙の並ぶ本棚として表示されます。リスト表示への切替もできます。" },
  { title: "写真の台形補正と3面登録", body: "表表紙・背表紙・裏表紙の写真を登録でき、斜めに撮れた写真は台形補正でまっすぐに整えられます。" },
  { title: "進捗とメモ", body: "読み進めたページや聴いた曲の進捗を記録。1アイテムに複数のメモを残せます。" },
  { title: "フォルダ分けと公開・共有", body: "フォルダで蔵書を分けて整理。フォルダごと、または本棚全体を公開ページとして共有できます。" },
];

const FAQS = [
  { q: "無料で使えますか？", a: "はい。登録・本棚表示・スキャン・台形補正・メモ・進捗など、基本機能はすべて無料です。Notionへの自動連携、CSV・Excelダウンロード、Googleスプレッドシートへの書き出しは月額300円のエクスポートプランで使えます。" },
  { q: "CDやDVDも管理できますか？", a: "はい。書籍だけでなくCD・DVD・雑誌なども登録できます。木の本棚に背表紙やジャケットを並べるように、まとめて管理できます。" },
  { q: "バーコードで登録できますか？", a: "はい。書籍はバーコード（ISBN）、CDは規格品番を読み取るだけで、書誌・ディスク情報を自動で取得します。手入力の手間を減らせます。" },
  { q: "公開・共有はできますか？", a: "はい。フォルダごと、または本棚全体を公開ページとして共有できます。公開ページはログインなしで誰でも閲覧できます。" },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

const wrap = { maxWidth: 960, margin: "0 auto", padding: "0 20px" };

export default function PromoView() {
  return (
    <div style={{ background: "#fdf6ee", color: "#2d1a08", minHeight: "100vh", fontFamily: "'Noto Sans JP', sans-serif" }}>
      <header style={{ ...wrap, display: "flex", alignItems: "center", gap: 12, paddingTop: 20, paddingBottom: 4 }}>
        <img src="/icon-192.png" alt="" width="40" height="40" style={{ borderRadius: 10 }} />
        <span style={{ fontFamily: "'Noto Serif JP', serif", fontWeight: 700, fontSize: 20 }}>わたしの本棚の手帖</span>
        <span style={{ marginLeft: "auto" }}>
          <a href="/" style={{ color: "#b8620a", fontWeight: 700, textDecoration: "none" }}>アプリを開く</a>
        </span>
      </header>

      <main style={wrap}>
        <section style={{ textAlign: "center", padding: "36px 0 8px" }}>
          <h1 style={{ fontFamily: "'Noto Serif JP', serif", fontSize: "clamp(30px, 6vw, 46px)", margin: "0 0 14px", lineHeight: 1.3 }}>
            わたしの本棚の手帖
          </h1>
          <p style={{ fontFamily: "'Noto Serif JP', serif", fontSize: "clamp(18px, 3.4vw, 24px)", color: "#6b543f", lineHeight: 1.6, margin: "0 0 14px" }}>
            本も、CDも、DVDも。<br />木の本棚に並べるように。
          </p>
          <p style={{ color: "#6b543f", fontSize: 16, lineHeight: 1.8, margin: "0 auto 22px", maxWidth: 620 }}>
            「わたしの本棚の手帖」は、書籍・CD・DVDなどを木の本棚のメタファーで管理するWebアプリです。
            蔵書管理と読書記録をひとつの本棚に。バーコード・ISBNスキャンで自動登録し、フォルダ分けや公開・共有もできます。
          </p>
          <a href="/" style={{ display: "inline-block", background: "#b8620a", color: "#fff8f0", padding: "13px 34px", borderRadius: 999, fontWeight: 700, textDecoration: "none", fontSize: 16 }}>
            無料ではじめる
          </a>
        </section>

        <figure style={{ margin: "30px 0 10px" }}>
          <img
            src="/promo-shelf.jpg"
            alt="わたしの本棚の手帖の本棚ビュー（実際のアプリ画面）"
            style={{ width: "100%", height: "auto", display: "block", borderRadius: 16, border: "1px solid #e8dcc8", boxShadow: "0 18px 40px rgba(45, 26, 8, 0.18)" }}
          />
          <figcaption style={{ textAlign: "center", color: "#8a715a", fontSize: 13, marginTop: 10 }}>実際のアプリ画面（本棚ビュー）</figcaption>
        </figure>

        <section style={{ padding: "34px 0 6px" }}>
          <h2 style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 24, textAlign: "center", margin: "0 0 20px" }}>できること</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: "#fff8f0", border: "1px solid #eee0cb", borderRadius: 14, padding: "18px 16px" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#b8620a" }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: "#54402c" }}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: "34px 0 10px" }}>
          <h2 style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 24, textAlign: "center", margin: "0 0 20px" }}>料金</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, maxWidth: 680, margin: "0 auto" }}>
            <div style={{ background: "#fff8f0", border: "1px solid #eee0cb", borderRadius: 14, padding: "22px 20px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 17 }}>基本プラン</h3>
              <p style={{ margin: "0 0 12px", fontFamily: "'Noto Serif JP', serif", fontSize: 26 }}>無料</p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: "#54402c" }}>登録・本棚表示・スキャン・台形補正・メモ・進捗など、基本機能はすべて無料です。</p>
            </div>
            <div style={{ background: "#fff8f0", border: "2px solid #b8620a", borderRadius: 14, padding: "22px 20px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "#b8620a" }}>エクスポートプラン</h3>
              <p style={{ margin: "0 0 12px", fontFamily: "'Noto Serif JP', serif", fontSize: 26 }}>月額 300円</p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: "#54402c" }}>Notion への自動連携、CSV・Excel ダウンロード、Google スプレッドシートへの書き出しが使えるようになります。</p>
            </div>
          </div>
        </section>

        <section style={{ padding: "34px 0 10px" }}>
          <h2 style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 24, textAlign: "center", margin: "0 0 20px" }}>よくある質問</h2>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            {FAQS.map((f) => (
              <div key={f.q} style={{ background: "#fff8f0", border: "1px solid #eee0cb", borderRadius: 14, padding: "18px 20px", marginBottom: 12 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#b8620a" }}>{f.q}</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: "#54402c" }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

        <section style={{ textAlign: "center", padding: "30px 0 44px" }}>
          <a href="/" style={{ display: "inline-block", background: "#b8620a", color: "#fff8f0", padding: "13px 34px", borderRadius: 999, fontWeight: 700, textDecoration: "none", fontSize: 16 }}>
            アプリを開く
          </a>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid #eee0cb", padding: "18px 0 26px", textAlign: "center", color: "#8a715a", fontSize: 13 }}>
        <p style={{ margin: 0 }}>© Meteor Creator Studio</p>
      </footer>
    </div>
  );
}
