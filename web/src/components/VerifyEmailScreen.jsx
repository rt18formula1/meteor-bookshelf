import React, { useState } from "react";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "../firebase.js";
import { useApp } from "../store.jsx";
import { IconBookLogo } from "./Icons.jsx";

/* メールアドレス＋パスワードで登録し、メール確認が未完了のユーザーに表示する画面。
   確認が完了するまでは API を利用できない（Worker 側でも 401 email_not_verified を返す）。
   Google ログインのユーザーは対象外（Google 側でメールアドレス確認済み）。 */
export default function VerifyEmailScreen() {
  const { user, setUser } = useApp();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    setNotice("");
    setError("");
    setBusy(true);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("not-signed-in");
      await sendEmailVerification(u);
      setNotice("確認メールを送信しました。メール内のリンクを開いて認証を完了してください。");
    } catch (e) {
      setError(e && e.code === "auth/too-many-requests"
        ? "送信回数が多すぎます。しばらく待ってから再度お試しください。"
        : "確認メールの送信に失敗しました。しばらく待ってから再度お試しください。");
    }
    setBusy(false);
  };

  /* 確認リンクを開いた後に押す。ユーザー情報を再読み込みし、認証済みなら本棚へ進む */
  const refresh = async () => {
    setNotice("");
    setError("");
    setBusy(true);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("not-signed-in");
      await u.reload();
      const updated = auth.currentUser;
      if (updated) {
        setUser({
          id: updated.uid,
          email: updated.email,
          emailVerified: updated.emailVerified,
          isPasswordUser: updated.providerData.some((p) => p.providerId === "password"),
        });
        if (!updated.emailVerified) {
          setNotice("まだ認証が完了していません。メール内のリンクを開いてから、もう一度お試しください。");
        }
      }
    } catch (_) {
      setError("確認に失敗しました。しばらく待ってから再度お試しください。");
    }
    setBusy(false);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-wood" aria-hidden="true" />
        <div className="login-body">
          <div className="login-brand">
            <IconBookLogo size={40} />
            <h1>メール確認が必要です</h1>
            <p className="muted small">{user && user.email ? `${user.email} 宛に確認メールを送信しました。` : "確認メールを送信しました。"}メール内のリンクを開いて認証を完了してください。</p>
          </div>
          <p className="muted small">認証が完了するまで、本棚の表示・登録はご利用いただけません。メールが届かない場合は、迷惑メールフォルダをご確認ください。</p>
          {notice && <p className="login-notice" role="status">{notice}</p>}
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="button" className="btn-primary btn-block" onClick={refresh} disabled={busy}>
            {busy ? "確認中…" : "認証が完了したらこちらを押す"}
          </button>
          <div style={{ height: 10 }} />
          <button type="button" className="btn-secondary btn-block" onClick={resend} disabled={busy}>
            確認メールを再送信する
          </button>
          <p className="login-switch">
            <button type="button" className="text-link" onClick={logout}>別のアカウントでログインする</button>
          </p>
          <p className="app-credit">© Meteor Creator Studio</p>
        </div>
      </div>
    </div>
  );
}
