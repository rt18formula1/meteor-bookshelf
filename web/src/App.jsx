import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase.js";
import { useApp } from "./store.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import HomeView from "./views/HomeView.jsx";
import SearchView from "./views/SearchView.jsx";
import ScanView from "./views/ScanView.jsx";
import MemosView from "./views/MemosView.jsx";
import SettingsView from "./views/SettingsView.jsx";
import ItemDetailModal from "./components/ItemDetailModal.jsx";
import ItemFormModal from "./components/ItemFormModal.jsx";
import CoverEditorModal from "./components/CoverEditorModal.jsx";
import { IconBookLogo, IconMemo, IconScan, IconSearch, IconSettings, IconShelf } from "./components/Icons.jsx";

const NAV = [
  { view: "home", label: "本棚", Icon: IconShelf },
  { view: "search", label: "検索", Icon: IconSearch },
  { view: "scan", label: "スキャン", Icon: IconScan },
  { view: "memos", label: "メモ", Icon: IconMemo },
  { view: "settings", label: "設定", Icon: IconSettings },
];

export default function App() {
  const { user, setUser, view, setView, totalCount } = useApp();
  const [viewMode, setViewMode] = useState("shelf"); // shelf | list

  /* 認証は Firebase Authentication。onAuthStateChanged でユーザー状態を管理する */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser ? { id: fbUser.uid, email: fbUser.email } : null);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user === undefined) {
    return (
      <div className="boot-screen">
        <IconBookLogo size={40} />
        <p className="muted">読み込み中…</p>
      </div>
    );
  }

  if (user === null) {
    return <LoginScreen />;
  }

  return (
    <div>
      {view !== "home" && (
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <IconBookLogo size={24} />
              <span>私の本棚</span>
            </div>
            <div className="topbar-actions">
              <span className="total-count">全{totalCount}点</span>
            </div>
          </div>
        </header>
      )}

      <main className={`main${view === "home" ? " main-home" : ""}`}>
        {view === "home" && <HomeView viewMode={viewMode} setViewMode={setViewMode} />}
        {view === "search" && <SearchView />}
        {view === "scan" && <ScanView />}
        {view === "memos" && <MemosView />}
        {view === "settings" && <SettingsView />}
      </main>

      <nav className="bottomnav">
        {NAV.map(({ view: v, label, Icon }) =>
          v === "scan" ? (
            <button
              key={v}
              className="nav-fab"
              onClick={() => setView(v)}
              aria-label={label}
            >
              <Icon size={26} />
            </button>
          ) : (
            <button
              key={v}
              className={`nav-item${view === v ? " active" : ""}`}
              onClick={() => setView(v)}
            >
              <Icon size={22} />
              <span>{label}</span>
            </button>
          )
        )}
      </nav>

      <ItemDetailModal />
      <ItemFormModal />
      <CoverEditorModal />
    </div>
  );
}
