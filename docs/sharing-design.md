# 共有機能 設計書 — 私の本棚（meteor-bookshelf）

作成日：2026-11-26。フォルダ機能・公開ページ・OGP・PDF/画像エクスポートの設計と実装記録。

## 目的

本棚を「見せる」ことでアプリを広げる。フォルダで整理し、公開する範囲を選び、
SNSに投稿しやすい形（共有リンク／画像／PDF）で共有できるようにする。

## 1. フォルダ機能

### 概念

- フォルダは本棚の中の「入れ物」。アイテムは1つのフォルダに属する（未分類も可）。
- カテゴリー（既存の自由ラベル）とは別概念。カテゴリーは属性、フォルダは入れ物として扱う。
- フォルダ未設定の既存アイテムは「未分類」として従来通り表示される（後方互換）。

### データモデル（D1）

```sql
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  share_id TEXT NOT NULL UNIQUE,         -- 公開URL用の推測困難なランダム文字列（15文字）
  is_public INTEGER NOT NULL DEFAULT 0,  -- 1=公開、0=非公開
  sort_order INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_folders_share ON folders(share_id);
CREATE INDEX IF NOT EXISTS idx_items_folder ON items(user_id, folder_id);
```

- `items` に `folder_id INTEGER`（NULL=未分類）を追加。外部キーではなく論理参照。
- スキーマの正本は `schema.sql`（新規DB用）。既存DBへの適用は Worker 起動時に
  `ensureSchema()` が `CREATE TABLE IF NOT EXISTS folders ...` と
  `ALTER TABLE items ADD COLUMN folder_id INTEGER`（重複エラーは無視）を
  プロセスごとに1回だけ実行する（マイグレーション実行用の外部ツールに依存しない）。

### API（認証必須・本人のみ）

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/folders` | 自分のフォルダ一覧（`item_count` 付き、並び順） |
| POST | `/api/folders` | 作成 `{name}`。`share_id` を自動生成。`is_public` は常に非公開で作成 |
| PATCH | `/api/folders/:id` | 名前変更 `{name}`、公開切替 `{is_public}` |
| DELETE | `/api/folders/:id` | 削除。中身のアイテムは `folder_id=NULL`（未分類）に戻し、アイテム自体は削除しない |
| PUT | `/api/folders/reorder` | 並び替え `{ids}`（自分のフォルダのみ） |

- アイテムの作成・更新で `folder_id` を受け付ける。他人のフォルダIDを指定された場合は
  `NULL`（未分類）として扱い、他人のフォルダへは移動できない。
- 一覧・CSV/JSONエクスポートは `?folder=<id>` / `?folder=none`（未分類）で絞り込める。

### UI

- ホームにフォルダチップ（すべて／未分類／各フォルダ＋件数）を追加。選択でその中のアイテムだけ表示。
- フォルダ管理モーダル：作成・名前変更・公開切替・並び替え（↑↓）・削除。
- 登録・編集フォームにフォルダ選択（未分類／各フォルダ）を追加。

## 2. 公開ページと共有URL

### URLと識別子

- 公開URLは `/s/:shareId`（例：`https://meteor-bookshelf.rb18vcarb.workers.dev/s/Ab3dEf9Gh2JkLm4`）。
- `share_id` はフォルダ作成時に生成する15文字のランダム文字列
  （紛らわしい文字を除いた57文字の英数字、約87ビット）。フォルダの内部IDは晒さない。
- デフォルトは非公開。公開はフォルダ管理モーダルまたは共有モーダルで切り替える。
- 本棚全体の公開URLは今回の対象外（フォルダ単位のみ）。

### 公開API（認証不要）

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/public/folders/:shareId` | 公開フォルダの情報と中のアイテム一覧。非公開・存在しない場合は404 |
| GET | `/api/public/images/:key` | 公開フォルダ内アイテムの画像（R2/KV）。公開フォルダに属さない画像は404 |

- 返す情報は表示に必要なものだけ（種別・タイトル・著者・出版社・ISBN・規格品番・版・価格・表紙）。
  所有者のメールアドレス・ユーザーID・Notion情報・メモは含めない。
- 公開ページは読み取り専用。編集・追加・削除はできない。

### 公開ページ（`/s/:shareId`）

- Worker が `/s/:shareId` へのアクセスを横取りし、OGPを差し込んだ `index.html` を返す。
  React アプリはパスを見てログイン不要の公開ビュー（`PublicView`）を表示する。
- 公開ビューはフォルダ名・件数・アイテム一覧（表紙・タイトル・著者・価格）を表示する。
- 表紙画像は公開画像エンドポイント経由（認証不要）で表示する。画像がない場合はタイトル頭文字のタイルで代替表示する。
- 非公開・存在しない場合は「このページは存在しないか、非公開です」と表示する。

## 3. OGP（SNSプレビュー）

- 公開ページのHTMLを Worker が返す際に、フォルダに応じた OGP メタタグを動的に差し込む。
  - `og:title`：フォルダ名（例：`漫画 — 私の本棚`）
  - `og:description`：フォルダ名と件数
  - `og:url`：公開URL
  - `og:image`：代表的な表紙画像（ユーザー写真は公開画像URL、外部表紙はそのURL）。画像がなければ省略
  - `twitter:card`：画像ありは `summary_large_image`、なしは `summary`
- フォルダ名はHTMLエスケープして差し込む。非公開・存在しないフォルダの場合は汎用のタイトル・説明にする。
- 静的な `index.html` には OGP を置かない（全ページ共通になってしまうため）。

## 4. PDF/画像エクスポート（共有カード）

- 共有モーダルから、フォルダ（または本棚全体）を画像（PNG）・PDFとして保存できる。
- 画像（PNG）：1080×1080の共有カード。Canvas APIでクライアント側に描画する。
  フォルダ名・冊数・表紙グリッド（最大9枚）・「私の本棚」の表記を入れる。
  表紙がないアイテムは色付きタイル＋タイトル頭文字で代替表示する。
- PDF：jsPDFで組み立てる。1ページ目に共有カード画像、続くページにアイテム一覧
  （タイトル・著者・出版社・価格）を載せる。一覧ページも Canvas に描画して画像として
  PDFに埋め込む（jsPDFの標準フォントは日本語を扱えないため）。
- Web Share APIが使える環境では、生成したPNGファイルを共有シートで送れる。
  使えない環境ではダウンロードにフォールバックする。
- 表紙画像の取得：ユーザー写真（`image_key`）は認証付きでBlobとして取得し、
  外部表紙（`cover_url`）はCORSで取得を試みる。取得できない場合は代替タイルにする
  （Canvasが汚染されると画像化できないため、取得失敗時は描画しない）。
- 共有カード・PDFの生成はクライアント側で行い、サーバーコストがかからない。
  拡散が目的のため、有料プラン（エクスポートプラン）の権利は不要とする。

## 5. セキュリティ

- 公開APIは `share_id` と `is_public=1` の両方を確認する。非公開・他人のフォルダは取得できない。
- `share_id` は推測困難なランダム文字列。内部ID（連番）はURLに出さない。
- 公開APIの応答に個人情報（メールアドレス・ユーザーID・Notion情報・メモ）を含めない。
- 公開画像エンドポイントは、公開フォルダ内のアイテムの画像キーに一致する場合だけ返す。
- 公開ページは読み取り専用。公開経由でアイテムの作成・更新・削除はできない。
- フォルダの公開切替・削除は本人の認証必須。

## 6. 今回やらないこと

- 本棚全体の公開URL（フォルダ単位のみ。全体共有はPNG/PDFで行う）
- 公開ページでのフォロー・いいね・コメント等のソーシャル機能
- 公開ページの検索エンジン向けサイトマップ
- 検索ビューへのフォルダ絞り込み（ホームのフォルダチップで代替）
