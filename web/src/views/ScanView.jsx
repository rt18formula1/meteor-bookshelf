import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../store.jsx";
import { TYPE_LABEL } from "../utils.js";
import { IconCamera, IconEdit, IconScan } from "../components/Icons.jsx";

export default function ScanView() {
  const { toast, openForm } = useApp();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [catno, setCatno] = useState("");
  const [lookupStatus, setLookupStatus] = useState("");
  const [results, setResults] = useState([]);
  const [ocrBusy, setOcrBusy] = useState(false);
  /* 雑誌（491始まりの定期刊行物JANコード）: バーコードからは号数・年・価格だけが
     導出でき、タイトルは取得できないため、タイトル検索または手入力で補う */
  const [magazine, setMagazine] = useState(null);
  const [titleQuery, setTitleQuery] = useState("");
  const [titleResults, setTitleResults] = useState([]);
  const [titleStatus, setTitleStatus] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const zxingRef = useRef(null);
  const ocrFileRef = useRef(null);

  const doLookup = async (rawCode) => {
    const c = String(rawCode || "").replace(/[-\s]/g, "");
    if (!c) return;
    setLookupStatus("検索中…");
    setResults([]);
    setMagazine(null);
    setTitleResults([]);
    setTitleStatus("");
    try {
      const data = await api(`/api/lookup?code=${encodeURIComponent(c)}`);
      if (!data.results.length) {
        setLookupStatus("見つかりませんでした。手動登録をお試しください。");
        return;
      }
      /* 雑誌JANコード（491始まり）はタイトルが空で返る。号数・価格は導出済みなので
         専用パネルでタイトル検索または手入力に進む（汎用の結果一覧には載せない） */
      const first = data.results[0];
      if (first && first.type === "magazine") {
        setMagazine(first);
        setLookupStatus("雑誌のバーコードを読み取りました。タイトルを検索するか、手入力で登録してください。");
        return;
      }
      setLookupStatus(`${data.results.length}件見つかりました。タップで登録フォームに反映します。`);
      setResults(data.results);
    } catch (e) {
      setLookupStatus("検索に失敗しました: " + e.message);
    }
  };

  /* 雑誌のタイトル検索（NDLサーチ）。候補を選ぶと雑誌のJAN・号数・価格と合わせてフォームに反映する */
  const doTitleLookup = async (rawTitle) => {
    const q = String(rawTitle || "").trim();
    if (!q) return;
    setTitleStatus("タイトルで検索中…");
    setTitleResults([]);
    try {
      const data = await api(`/api/lookup?title=${encodeURIComponent(q)}`);
      if (!data.results.length) {
        setTitleStatus("見つかりませんでした。タイトルを変えるか、手入力で登録してください。");
        return;
      }
      setTitleStatus(`${data.results.length}件見つかりました。タップで登録フォームに反映します。`);
      setTitleResults(data.results);
    } catch (e) {
      setTitleStatus("検索に失敗しました: " + e.message);
    }
  };

  /* 雑誌の登録フォームを開く。タイトル候補があればその書誌情報を使い、
     JANコード・号数・価格はバーコードから導出した値を優先する */
  const openMagazineForm = (candidate) => {
    if (!magazine) return;
    openForm({
      ...(candidate || {}),
      type: "magazine",
      title: (candidate && candidate.title) || "",
      creator: (candidate && candidate.creator) || "",
      publisher: (candidate && candidate.publisher) || "",
      isbn: magazine.isbn,
      catno: "",
      edition: magazine.edition || (candidate && candidate.edition) || "",
      price: magazine.price || (candidate && candidate.price) || "",
      cover_url: (candidate && candidate.cover_url) || "",
    });
  };

  const doCatnoLookup = async (rawCatno) => {
    const c = String(rawCatno || "").trim();
    if (!c) return;
    setLookupStatus("品番で検索中…");
    setResults([]);
    setMagazine(null);
    setTitleResults([]);
    setTitleStatus("");
    try {
      const data = await api(`/api/lookup?catno=${encodeURIComponent(c)}`);
      if (!data.results.length) {
        setLookupStatus("見つかりませんでした。品番を確認するか、手動登録をお試しください。");
        return;
      }
      setLookupStatus(`${data.results.length}件見つかりました。タップで登録フォームに反映します。`);
      setResults(data.results);
    } catch (e) {
      setLookupStatus("検索に失敗しました: " + e.message);
    }
  };

  const stopScan = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (zxingRef.current) {
      try { zxingRef.current.stop(); } catch (_) {}
      zxingRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  };

  const startScan = async () => {
    setScanning(true);
    try {
      if ("BarcodeDetector" in window) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        const loop = async () => {
          if (!streamRef.current) return;
          try {
            const codes = await detector.detect(video);
            if (codes && codes.length) {
              const value = codes[0].rawValue;
              stopScan();
              setCode(value);
              doLookup(value);
              return;
            }
          } catch (_) {}
          timerRef.current = setTimeout(loop, 350);
        };
        loop();
      } else {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        zxingRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (result) {
            const value = result.getText();
            stopScan();
            setCode(value);
            doLookup(value);
          }
        });
      }
    } catch (e) {
      toast("カメラを起動できませんでした: " + e.message);
      stopScan();
    }
  };

  /* ビューを離れたらカメラを止める */
  useEffect(() => () => stopScan(), []);

  const onOcrFile = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f || ocrBusy) return;
    setOcrBusy(true);
    toast("OCRで読み取り中…（少し時間がかかります）");
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(f, "jpn+eng");
      const lines = data.text.split("\n").map((s) => s.trim()).filter((s) => s.length >= 2);
      if (!lines.length) {
        toast("文字を読み取れませんでした");
        return;
      }
      const isbnMatch = data.text.replace(/[-\s]/g, "").match(/97[89]\d{10}/);
      openForm({ title: lines[0], isbn: isbnMatch ? isbnMatch[0] : "" });
      toast(`OCR結果を反映しました: ${lines[0]}`);
    } catch (err) {
      toast("OCRに失敗しました: " + err.message);
    } finally {
      setOcrBusy(false);
    }
  };

  return (
    <section className="view">
      <h2 className="view-title">追加・スキャン</h2>
      <div className="card">
        <h3>バーコードで追加</h3>
        {/* video は常時マウントし、スキャン中だけ表示する（ref の付け替えを避ける） */}
        <video
          ref={videoRef}
          className="scan-video"
          playsInline
          muted
          autoPlay
          style={{ display: scanning ? "block" : "none" }}
        />
        {scanning && <p className="muted small">バーコードをカメラに映してください…</p>}
        <div className="row-gap">
          {!scanning ? (
            <button className="btn-primary" onClick={startScan}>
              <IconCamera size={17} /> カメラでスキャン
            </button>
          ) : (
            <button className="btn-secondary" onClick={stopScan}>停止</button>
          )}
        </div>
        <div className="divider" />
        <label>ISBN / バーコードを入力
          <div className="row-gap">
            <input
              type="text"
              inputMode="numeric"
              placeholder="9784... / 4988... / 4912...（雑誌）"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doLookup(code); } }}
            />
            <button className="btn-secondary" onClick={() => doLookup(code)}>検索</button>
          </div>
        </label>
        <div className="divider" />
        <label>規格品番で探す
          <div className="row-gap">
            <input
              type="text"
              placeholder="例: VICL-12345 / SRCL-99999"
              value={catno}
              onChange={(e) => setCatno(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doCatnoLookup(catno); } }}
            />
            <button className="btn-secondary" onClick={() => doCatnoLookup(catno)}>検索</button>
          </div>
        </label>
        <p className="muted small">CD・DVD・BD の帯やジャケットに記載の品番（カタログ番号）で MusicBrainz から作品を特定します。</p>
        {lookupStatus && <p className="muted small">{lookupStatus}</p>}
        <div>
          {results.map((r, i) => (
            <div className="lookup-card" key={i} onClick={() => openForm(r)}>
              {r.cover_url && <img src={r.cover_url} alt="" onError={(e) => { e.currentTarget.remove(); }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="list-title">{r.title}</div>
                <div className="list-sub">{r.creator || ""} ／ {r.source} ／ {TYPE_LABEL[r.type] || ""}{r.catno ? ` ／ 品番 ${r.catno}` : ""}{r.edition ? ` ／ ${r.edition}` : ""}{r.price ? ` ／ ¥${Number(r.price).toLocaleString("ja-JP")}` : ""}</div>
              </div>
              <button className="btn-primary btn-small">登録</button>
            </div>
          ))}
        </div>
        {magazine && (
          <div>
            <div className="divider" />
            <p className="muted small">
              雑誌として認識しました。バーコードからはタイトルが取得できないため、タイトルを検索するか手入力で登録してください。
            </p>
            <div className="lookup-card">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="list-title">雑誌（タイトル未入力）</div>
                <div className="list-sub">
                  {magazine.source} ／ {TYPE_LABEL[magazine.type] || ""}
                  {magazine.isbn ? ` ／ JAN ${magazine.isbn}` : ""}
                  {magazine.edition ? ` ／ ${magazine.edition}` : ""}
                  {magazine.price ? ` ／ ¥${Number(magazine.price).toLocaleString("ja-JP")}` : ""}
                </div>
              </div>
            </div>
            <label>タイトルを検索
              <div className="row-gap">
                <input
                  type="text"
                  placeholder="例: 週刊少年ジャンプ"
                  value={titleQuery}
                  onChange={(e) => setTitleQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doTitleLookup(titleQuery); } }}
                />
                <button className="btn-secondary" onClick={() => doTitleLookup(titleQuery)}>検索</button>
              </div>
            </label>
            {titleStatus && <p className="muted small">{titleStatus}</p>}
            <div>
              {titleResults.map((r, i) => (
                <div className="lookup-card" key={i} onClick={() => openMagazineForm(r)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="list-title">{r.title}</div>
                    <div className="list-sub">{r.creator || ""} ／ {r.publisher || ""} ／ {r.source}</div>
                  </div>
                  <button className="btn-primary btn-small">登録</button>
                </div>
              ))}
            </div>
            <div className="row-gap wrap" style={{ marginTop: 8 }}>
              <button className="btn-secondary" onClick={() => openMagazineForm(null)}>
                <IconEdit size={16} /> タイトルを手入力で登録
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>その他の追加方法</h3>
        <div className="row-gap wrap">
          <button className="btn-secondary" onClick={() => openForm({})}>
            <IconEdit size={16} /> 手動で登録
          </button>
          <button className="btn-secondary" onClick={() => ocrFileRef.current && ocrFileRef.current.click()} disabled={ocrBusy}>
            <IconScan size={16} /> {ocrBusy ? "OCR処理中…" : "写真からOCRで読み取る"}
          </button>
        </div>
        <p className="muted small">OCRは本の表紙や奥付の写真からタイトル候補を読み取り、登録フォームに反映します。</p>
        <input ref={ocrFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onOcrFile} />
      </div>
    </section>
  );
}
