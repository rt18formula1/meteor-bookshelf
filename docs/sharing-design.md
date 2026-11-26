# 共有機能 設計書 — わたしの本棚の手帖（meteor-bookshelf）

作成日：2026-11-26。フォルダ機能・公開ページ・OGP・PDF/画像エクスポートの設計と実装記録。
更新：2026-11-26に以下を追加（共有カード・PDFのグリッド化、画像の自然比率、本棚全体の公開、SNS投稿、複数フォルダ）。

## 目的

本棚を「見せる」ことでアプリを広げる。フォルダで整理し、公開する範囲を選び、
SNSに投稿しやすい形（共有リンク／画像／PDF）で共有できるようにする。

## 1. フォルダ機能

### 概念

- フォルダは本棚の中の「入れ物」。1つのアイテムは複数のフォルダに属することができる（未分類も可）。
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

-- 1アイテム＝複数フォルダの中間テーブル（正本）
CREATE TABLE IF NOT EXISTS item_folders (
  item_id INTEGER NOT NULL REFERENCES items(id),
  folder_id INTEGER NOT NULL REFERENCES folders(id),
  PRIMARY KEY (item_id, folder_id)
);
CREATE INDEX IF NOT EXISTS idx_item_folders_folder ON item_folders(folder_id, item_id);
CREATE INDEX IF NOT EXISTS idx_item_folders_item ON item_folders(item_id);
```

- `items.folder_id INTEGER`（NULL=未分類）は互換のため残し、所属フォルダの先頭要素と同期させる。
  判定の正本は `item_folders` とする。
- スキーマの正本は `schema.sql`（新規DB用）。既存DBへの適用は Worker 起動時に
  `ensureSchema()` が `CREATE TABLE` / `ALTER TABLE`（重複エラーは無視）を
  プロセスごとに1回だけ実行する（マイグレーション実行用の外部ツールに依存しない）。
  既存の `items.folder_id` は `INSERT INTO item_folders SELECT id, folder_id FROM items WHERE folder_id IS NOT NULL`
  で中間テーブルへ移行する（2回目以降は主キー重複で無視される）。

### API（認証必須・本人のみ）

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/folders` | 自分のフォルダ一覧（`item_count` 付き、並び順）。`uncategorized_count`（どのフォルダにも属さない件数）も返す |
| POST | `/api/folders` | 作成 `{name}`。`share_id` を自動生成。`is_public` は常に非公開で作成 |
| PATCH | `/api/folders/:id` | 名前変更 `{name}`、公開切替 `{is_public}` |
| DELETE | `/api/folders/:id` | 削除。中間テーブルの該当行だけを消し、アイテム自体は削除しない。`items.folder_id` は残ったフォルダの先頭（なければ NULL）に合わせ直す |
| PUT | `/api/folders/reorder` | 並び替え `{ids}`（自分のフォルダのみ） |

- アイテムの作成・更新で `folder_ids`（配列）を受け付け、中間テーブルを同期する。
  従来の `folder_id`（単数）も受け付け、来た場合は1要素の `folder_ids` として扱う。
  他人のフォルダIDを指定された場合は無視する（自分のフォルダだけが有効）。
- 一覧・CSV/JSONエクスポートは `?folder=<id>` / `?folder=none`（未分類）で絞り込める。
  絞り込みは中間テーブル基準（`?folder=<id>` はそのフォルダに入っているアイテム、
  `?folder=none` はどのフォルダにも属さないアイテム）。
- `GET /api/items/:id` の応答には `folder_ids`（所属フォルダIDの配列）も含む。

### UI

- ホームにフォルダチップ（すべて／未分類／各フォルダ＋件数）を追加。選択でその中のアイテムだけ表示。
  複数フォルダに入っているアイテムは各フォルダの下に表示される。未分類件数は
  `GET /api/folders` の `uncategorized_count` を使う（全体−合計では求まらないため）。
- フォルダ管理モーダル：作成・名前変更・公開切替・並び替え（↑↓）・削除。
- 登録・編集フォームのフォルダ選択は複数選択（チェックボックス一覧）。未選択なら未分類。

## 2. 公開ページと共有URL

### URLと識別子

- フォルダの公開URLは `/s/:shareId`（例：`https://meteor-bookshelf.rb18vcarb.workers.dev/s/Ab3dEf9Gh2JkLm4`）。
- 本棚全体の公開URLは `/s/all/:shareId`（例：`https://meteor-bookshelf.rb18vcarb.workers.dev/s/all/Ab3dEf9Gh2JkLm4`）。
- `share_id` は15文字のランダム文字列（紛らわしい文字を除いた57文字の英数字、約87ビット）。
  フォルダの内部ID・ユーザーの内部IDは晒さない。
- デフォルトは非公開。公開はフォルダ管理モーダルまたは共有モーダルで切り替える。
- 本棚全体の公開設定は `users.public_share_id` / `users.is_public` で管理する。
  公開にする際に `share_id` が未発行なら新規発行する（衝突時は最大3回まで再生成）。

### 公開API（認証不要）

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/public/folders/:shareId` | 公開フォルダの情報と中のアイテム一覧。非公開・存在しない場合は404 |
| GET | `/api/public/collection/:shareId` | 公開中の本棚全体の情報とアイテム一覧（最大500件）。非公開・存在しない場合は404 |
| GET | `/api/public/images/:key` | 公開フォルダ内アイテム、または本棚全体を公開中のユーザーのアイテムの画像（R2/KV）。それ以外は404 |

### 公開設定API（認証必須）

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/settings/public-collection` | 本棚全体の公開設定 `{ is_public, share_id, url }` |
| PUT | `/api/settings/public-collection` | 公開切替 `{ is_public }`。公開時に `share_id` が未発行なら新規発行する |

- 返す情報は表示に必要なものだけ（種別・タイトル・著者・出版社・ISBN・規格品番・版・価格・表紙）。
  所有者のメールアドレス・ユーザーID・Notion情報・メモは含めない。
- 公開ページは読み取り専用。編集・追加・削除はできない。

### 公開ページ（`/s/:shareId`、`/s/all/:shareId`）

- Worker が `/s/:shareId` / `/s/all/:shareId` へのアクセスを横取りし、OGPを差し込んだ `index.html` を返す。
  React アプリはパスを見てログイン不要の公開ビュー（`PublicView`）を表示する。
- 公開ビューは名前・件数・アイテム一覧（表紙・タイトル・著者・価格）を表示する。
- 表紙画像は公開画像エンドポイント経由（認証不要）で表示する。画像がない場合はタイトル頭文字のタイルで代替表示する。
  本棚全体の公開ページでは、棚と同じ優先順位（背表紙 → 表表紙 → 裏表紙 → 外部表紙）で画像を選ぶ。
- 非公開・存在しない場合は「このページは存在しないか、非公開です」と表示する。

## 3. OGP（SNSプレビュー）

- 公開ページのHTMLを Worker が返す際に、公開対象に応じた OGP メタタグを動的に差し込む。
  - フォルダ：`og:title` はフォルダ名（例：`漫画 — わたしの本棚の手帖`）、`og:description` はフォルダ名と件数
  - 本棚全体：`og:title` は `わたしの本棚の手帖`、`og:description` は件数
  - `og:url`：公開URL、 `og:image`：代表的な表紙画像（ユーザー写真は公開画像URL、外部表紙はそのURL）。画像がなければ省略
  - `twitter:card`：画像ありは `summary_large_image`、なしは `summary`
- 名前はHTMLエスケープして差し込む。非公開・存在しない場合は汎用のタイトル・説明にする。
- 静的な `index.html` には OGP を置かない（全ページ共通になってしまうため）。

## 4. PDF/画像エクスポート（共有カード）

- 共有モーダルから、フォルダ（または本棚全体）を画像（PNG）・PDFとして保存できる。
- 画像（PNG）：1080×1080の共有カード。Canvas APIでクライアント側に描画する。
  フォルダ名・冊数・表紙の棚（自然な縦横比で横に並べる行レイアウト、最大20件）・「わたしの本棚の手帖」の表記を入れる。
  表紙がないアイテムは色付きタイル＋タイトル頭文字で代替表示する。
- PDF：jsPDFで組み立てる。1ページ目に共有カード画像、続くページに表紙＋タイトルのグリッド
  （自然な縦横比の棚の行、作者・出版社・価格は出さない）を載せる。各ページも Canvas に描画して画像として
  PDFに埋め込む（jsPDFの標準フォントは日本語を扱えないため）。
  ページ分けは比率の計測パスで先に確定させ、描画パスでは同じ比率でレイアウトする（ページ数の表示がずれない）。
- Web Share APIが使える環境では、生成したPNGファイルを共有シートで送れる。
  使えない環境ではダウンロードにフォールバックする。
- 表紙画像の取得：ユーザー写真（背表紙・表表紙・裏表紙のキー）は棚と同じ優先順位
  （背表紙 → 表表紙 → 裏表紙）で認証付きでBlobとして取得し、
  外部表紙（`cover_url`）はCORSで取得を試みる。取得できない場合は代替タイルにする
  （Canvasが汚染されると画像化できないため、取得失敗時は描画しない）。
  `apiImageObjectUrl` の blob URL はアプリ全体でキャッシュ共有しているため、
  共有エクスポート側で revoke しない（自分で作った外部表紙の blob URL だけ破棄する）。
- 共有カード・PDFの生成はクライアント側で行い、サーバーコストがかからない。
  拡散が目的のため、有料プラン（エクスポートプラン）の権利は不要とする。

### 棚の行レイアウト（共有カード・PDF共通）

- 行の高さを固定し、各冊の幅＝行高×（画像幅／画像高さ）として横に並べ、幅が足りなくなったら次の行へ折り返す。
- セルの幅は表紙幅と最低幅（タイトルが読める幅）の大きい方。表紙はセル内で中央寄せ。
- 共有カード：行高168（表紙110＋間隔6＋タイトル22px×2行）、4行まで、行間12。グリッド 284-992、フッター1032。
- PDFグリッドページ：行高274（表紙208＋間隔8＋タイトル24px×2行）、5行まで、行間22。グリッド 164-1622、フッター1690。
- 表紙幅の上限は共有カード240px・PDF320px、下限は28px。画像がない場合の代替タイルは比率0.707の本型。

## 5. 画像の自然比率（棚・詳細・共有）

- 棚（Spine）：背表紙（`spine_key`）の写真がある場合、その画像の自然な縦横比で背表紙の幅を決める。
  高さは従来の `spineSize` の高さ、幅＝高さ×（画像幅／画像高さ）で 24〜96px に収める。
  画像がない・読めない場合は従来のハッシュによる固定サイズのまま。
- 詳細モーダル：アップロードした表表紙（`image_key`）がある場合、その画像の自然な比率で表示する
  （幅110px・高さ200px以内に収める）。画像がない・リンク画像のみの場合は従来の 0.707 のまま。
- 共有カード・PDF：上記「棚の行レイアウト」の通り、自然な縦横比で並べる。
- 画像の寸法は `api.js` の `loadImageSize(src)` で読む（`/api/images/` は認証付き blob URL、外部URLは直接読む）。

## 6. SNS投稿（X・Instagram）

- 共有モーダルの「SNSで共有」セクション。フォルダ・本棚全体のどちらでも使える。
- 投稿テンプレ：編集可能なテキストエリア。既定は
  `📚 わたしの本棚の手帖「{name}」に {count} 冊！\n{url}\n#わたしの本棚の手帖 #読書記録`。
  `{name}`＝フォルダ名または「本棚全体」、`{count}`＝冊数、`{url}`＝公開URLに置換する。
  未公開の場合はURLは空になり、空行は詰める。
- 「キャプションをコピー」：置換後の全文をクリップボードへコピーする。
- X：「Xで投稿する」で `https://twitter.com/intent/tweet?text=<置換後テンプレをURLエンコード>` を新しいタブで開く。
  画像は intent では添付できないため、隣に「画像を保存（PNG）」を置き、手動で添付できるようにする。
- Instagram：「Instagramで投稿する」で共有カードPNGを `navigator.share`（files＋text）で渡して共有シートを開く。
  共有シートからInstagramを選べる。キャプションもコピーしておく（Instagramは共有テキストを受け取らない場合があるため）。
  ファイル共有に非対応の場合はPNGをダウンロードし、キャプションをコピーしたうえで
  「Instagramアプリで投稿してください」と案内する。

## 7. セキュリティ

- 公開APIは `share_id` と `is_public=1` の両方を確認する。非公開・他人のフォルダ／本棚は取得できない。
- `share_id` は推測困難なランダム文字列。内部ID（連番）はURLに出さない。
- 公開APIの応答に個人情報（メールアドレス・ユーザーID・Notion情報・メモ）を含めない。
- 公開画像エンドポイントは、公開フォルダ内のアイテム、または本棚全体を公開中のユーザーのアイテムの
  画像キーに一致する場合だけ返す。
- 公開ページは読み取り専用。公開経由でアイテムの作成・更新・削除はできない。
- フォルダ・本棚全体の公開切替・削除は本人の認証必須。

## 8. 今回やらないこと

- 公開ページでのフォロー・いいね・コメント等のソーシャル機能
- 公開ページの検索エンジン向けサイトマップ
- 検索ビューへのフォルダ絞り込み（ホームのフォルダチップで代替）
