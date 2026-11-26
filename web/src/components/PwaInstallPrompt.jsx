import React, { useEffect, useState } from "react";

/* スマホの WebApp（ホーム画面への追加）案内バナー。初回のみ表示する。
   - モバイルのブラウザで開いた場合のみ表示（デスクトップでは表示しない）
   - すでにホーム画面から起動している場合（standalone）は表示しない
   - 「閉じる」「あとで」を押すと localStorage に記録し、以後表示しない
   - iOS Safari は beforeinstallprompt 非対応のため手順を表示する
   - Android Chrome 等は beforeinstallprompt が来ればそのまま追加できるボタンにする */
const STORAGE_KEY = "pwa-install-prompt-dismissed";

function isMobile() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(max-width: 768px)").matches ||
    /Mobi|Android|iPhone|iPad|iPod/.test(window.navigator.userAgent)
  );
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  const ua = window.navigator.userAgent;
  /* iPadOS 13 以降は UA が Macintosh になるため、タッチ対応でも判定する */
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1)
  );
}

export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  /* beforeinstallprompt を捕捉しておく（Android Chrome 等） */
  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onAppInstalled = () => {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  /* 表示条件を満たす場合のみ、1.5秒後に表示する */
  useEffect(() => {
    if (!isMobile() || isStandalone()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch { /* ignore */ }
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt;
    setDeferredPrompt(null);
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch { /* ignore */ }
    /* 結果にかかわらず以後表示しない */
    dismiss();
  };

  if (!visible) return null;

  const ios = isIos();
  return (
    <div className="pwa-prompt" role="dialog" aria-label="ホーム画面への追加の案内">
      <button className="pwa-prompt-close" onClick={dismiss} aria-label="閉じる">×</button>
      <div className="pwa-prompt-title">ホーム画面に追加してアプリのように使う</div>
      <div className="pwa-prompt-body">
        {deferredPrompt
          ? "ホーム画面に追加すると、アプリのようにすぐ開けます。"
          : ios
            ? "共有ボタン（□に↑のアイコン）→「ホーム画面に追加」をタップすると、アプリのように使えます。"
            : "ブラウザのメニュー（⋮）→「ホーム画面に追加」をタップすると、アプリのように使えます。"}
      </div>
      <div className="pwa-prompt-actions">
        {deferredPrompt && (
          <button className="btn-primary" onClick={handleInstall}>ホーム画面に追加</button>
        )}
        <button className="btn-secondary" onClick={dismiss}>あとで</button>
      </div>
    </div>
  );
}
