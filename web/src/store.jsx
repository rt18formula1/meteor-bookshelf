import React, { createContext, useCallback, useContext, useRef, useState } from "react";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined=確認中, null=未ログイン, {id,email,emailVerified,isPasswordUser}=ログイン済み（Firebase Auth）
  const [view, setView] = useState("home");
  const [totalCount, setTotalCount] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);

  /* アイテム変更の通知カウンタ。各ビューはこれを見て再取得する */
  const [itemsVersion, setItemsVersion] = useState(0);
  const bumpItems = useCallback(() => setItemsVersion((v) => v + 1), []);

  /* モーダル類の状態（App レベルで一元管理し、どのビューからでも開けるようにする） */
  const [detail, setDetail] = useState(null); // { id, focusMemo }
  const [formPrefill, setFormPrefill] = useState(null); // null=閉, {}=開
  const [coverEditor, setCoverEditor] = useState(null); // { file, onDone }

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }, []);

  const openDetail = useCallback((id, focusMemo = false) => setDetail({ id, focusMemo }), []);
  const closeDetail = useCallback(() => setDetail(null), []);
  const openForm = useCallback((prefill = {}) => setFormPrefill(prefill), []);
  const closeForm = useCallback(() => setFormPrefill(null), []);
  const openCoverEditor = useCallback((file, onDone, label) => setCoverEditor({ file, onDone, label: label || "表紙" }), []);
  const closeCoverEditor = useCallback(() => setCoverEditor(null), []);

  const value = {
    user, setUser,
    view, setView,
    totalCount, setTotalCount,
    toast,
    itemsVersion, bumpItems,
    detail, openDetail, closeDetail,
    formPrefill, openForm, closeForm,
    coverEditor, openCoverEditor, closeCoverEditor,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </AppContext.Provider>
  );
}
