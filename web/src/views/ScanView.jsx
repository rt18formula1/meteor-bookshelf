import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../store.jsx";
import { TYPE_LABEL } from "../utils.js";
import { IconCamera, IconEdit, IconScan } from "../components/Icons.jsx";

export default function ScanView() {
  const { toast, openForm } = useApp();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [lookupStatus, setLookupStatus] = useState("");
  const [results, setResults] = useState([]);
  const [ocrBusy, setOcrBusy] = useState(false);
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
    try {
      const data = await api(`/api/lookup?code=${encodeURIComponent(c)}`);
      if (!data.results.length) {
        setLookupStatus("見つかりませんでした。手動登録をお試しください。");
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
              placeholder="9784... / 4988..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doLookup(code); } }}
            />
            <button className="btn-secondary" onClick={() => doLookup(code)}>検索</button>
          </div>
        </label>
        {lookupStatus && <p className="muted small">{lookupStatus}</p>}
        <div>
          {results.map((r, i) => (
            <div className="lookup-card" key={i} onClick={() => openForm(r)}>
              {r.cover_url && <img src={r.cover_url} alt="" onError={(e) => { e.currentTarget.remove(); }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="list-title">{r.title}</div>
                <div className="list-sub">{r.creator || ""} ／ {r.source} ／ {TYPE_LABEL[r.type] || ""}</div>
              </div>
              <button className="btn-primary btn-small">登録</button>
            </div>
          ))}
        </div>
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
