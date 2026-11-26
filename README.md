# わたしの本棚の手帖 — Bookshelf App

書籍・CD・DVD等を「木の本棚」のメタファーで管理するWebApp。
自分用に作りつつ、ユーザー登録制で小規模公開する想定です。

- 仕様書: [SPEC.md](./SPEC.md)
- デザイン正本: [DESIGN.md](./DESIGN.md)（Gesso「Cinematic 3」エクスポート）

## 技術構成

- **Runtime**: Cloudflare Workers（API + 静的アセット配信を単一Workerで提供）
- **DB**: Cloudflare D1（`schema.sql`）
- **画像保存**: Cloudflare KV（表紙の撮影写真。R2への差し替え可能）
- **フロントエンド**: バニラJS SPA（ビルドレス）/ BarcodeDetector + ZXing / Tesseract.js（OCR）
- **書誌情報**: OpenBD / Google Books / NDLサーチ / MusicBrainz + Cover Art Archive

## 主な機能

- 本棚ビュー: 背表紙の横スクロール棚（段ごと）、タップで引き出しアニメーション＋下部に情報パネル、リストビュー切替
- 登録: バーコードスキャン / ISBN入力 → 書誌情報と表紙を自動取得、OCR補助、手動登録
- 表紙: ネット自動取得 + 撮影写真の追加（四隅指定の台形補正つき）
- 詳細・メモ: 状態・進捗管理、読書メモ・視聴メモ（複数件）
- 検索: タイトル・著者検索、種別チップ、未読のみ / メモ付きのみ
- 認証: メール + パスワード（PBKDF2ハッシュ）、ユーザーごとに棚を分離

## ローカル開発

```bash
npm install
npx wrangler d1 execute bookshelf-db --local --file=schema.sql
npx wrangler dev
```

## デプロイ（Cloudflare）

mainブランチへpushすると、Cloudflare Workers Buildsが自動でビルド（`npm run build`）とデプロイ（`npx wrangler deploy`）を行います。設定はCloudflareダッシュボードの Workers & Pages → meteor-bookshelf → Settings → Builds で確認できます。

手動でデプロイする場合は、リポジトリのルートで `npx wrangler deploy` を実行します（要 `wrangler login`）。
