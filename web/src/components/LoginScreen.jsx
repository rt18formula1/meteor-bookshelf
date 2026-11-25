import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "../firebase.js";
import { recordVerificationEmailSent } from "../verifyEmail.js";
import { IconBookLogo } from "./Icons.jsx";

/* Firebase Auth のエラーコードを日本語の案内に変換する */
const ERROR_MESSAGES = {
  "auth/invalid-credential": "メールアドレスまたはパスワードが違います。",
  "auth/wrong-password": "メールアドレスまたはパスワードが違います。",
  "auth/user-not-found": "メールアドレスまたはパスワードが違います。",
  "auth/invalid-email": "メールアドレスの形式が正しくありません。",
  "auth/user-disabled": "このアカウントは無効化されています。",
  "auth/email-already-in-use": "このメールアドレスは既に登録されています。ログインをお試しください。",
  "auth/weak-password": "パスワードは6文字以上にしてください。",
  "auth/popup-closed-by-user": "ログインがキャンセルされました。",
  "auth/cancelled-popup-request": "ログインがキャンセルされました。",
  "auth/popup-blocked": "ポップアップがブロックされました。ブラウザの設定をご確認のうえ、再度お試しください。",
  "auth/network-request-failed": "ネットワークエラーが発生しました。接続をご確認ください。",
  "auth/too-many-requests": "試行回数が多すぎます。しばらく待ってから再度お試しください。",
  "auth/operation-not-allowed": "このログイン方法は現在利用できません。",
  "auth/account-exists-with-different-credential": "このメールアドレスは別の方法で登録されています。メールアドレスとパスワードでログインしてください。",
};
function toJapaneseError(e) {
  return ERROR_MESSAGES[e && e.code] || "ログインに失敗しました。しばらく待ってから再度お試しください。";
}

export default function LoginScreen() {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (ev) => {
    ev.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        /* 新規登録時は確認メールを送る。認証が完了するまでは確認画面が表示され、API は利用できない。
           （メール確認＝Stripe のセキュリティ対策申告「ユーザー登録時の個人情報の確認（メールアドレス）」に該当） */
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        try {
          await sendEmailVerification(cred.user);
          /* 登録時の送信を記録する。直後のログイン時（onAuthStateChanged）の自動送信が
             すぐに重なって送らないようにするため */
          recordVerificationEmailSent();
        } catch (_) {
          /* 送信失敗時は確認画面の「再送信」から送り直せる */
        }
      }
      /* 成功時は onAuthStateChanged が画面を切り替える（未確認の場合は確認画面へ） */
    } catch (e) {
      setError(toJapaneseError(e));
      setBusy(false);
    }
  };

  const google = async () => {
    setError("");
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      setError(toJapaneseError(e));
      setBusy(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError("");
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-wood" aria-hidden="true" />
        <div className="login-body">
          <div className="login-brand">
            <IconBookLogo size={40} />
            <h1>私の本棚</h1>
            <p className="muted small">書籍・CD・DVDを木の本棚で管理するアプリです</p>
          </div>

          <form onSubmit={submit}>
            <label>
              メールアドレス
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              パスワード
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit" className="btn-primary btn-block" disabled={busy}>
              {busy ? "処理中…" : mode === "login" ? "ログイン" : "新規登録"}
            </button>
          </form>

          <div className="login-divider"><span>または</span></div>

          <button type="button" className="btn-secondary btn-block google-btn" onClick={google} disabled={busy}>
            <span className="google-g" aria-hidden="true">G</span>
            Googleでログイン
          </button>

          <p className="login-switch">
            {mode === "login" ? (
              <>アカウントをお持ちでない方は{" "}
                <button type="button" className="text-link" onClick={() => switchMode("register")}>新規登録はこちら</button>
              </>
            ) : (
              <>すでにアカウントをお持ちの方は{" "}
                <button type="button" className="text-link" onClick={() => switchMode("login")}>ログインはこちら</button>
              </>
            )}
          </p>
          <p className="app-credit">© Meteor Creator Studio</p>
        </div>
      </div>
    </div>
  );
}
