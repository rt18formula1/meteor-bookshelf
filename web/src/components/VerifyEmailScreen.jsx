import React, { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";
import { sendVerificationEmail, getVerificationEmailStatus } from "../verifyEmail.js";
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
  const [resendWaitSec, setResendWaitSec] = useState(0);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);

  /* 再送の可否（60秒の間隔・1日5回の上限）を1秒ごとに更新する。
     ログイン時の自動送信で直前に送られた場合は、再送までの待ち時間を表示する */
  useEffect(() => {
    const update = () => {
      const st = getVerificationEmailStatus();
      setResendWaitSec(Math.ceil(st.resendWaitMs / 1000));
      setDailyLimitReached(st.dailyLimitReached);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  /* ログイン時の自動送信で直前にメールが送られている場合は、その旨を表示する */
  useEffect(() => {
    const st = getVerificationEmailStatus();
    if (st.lastSentAt && Date.now() - st.lastSentAt < 10 * 60 * 1000) {
      setNotice("確認メールを送信しました。メール内のリンクを開いて認証を完了してください。");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resend = async () => {
    setNotice("");
    setError("");
    const st = getVerificationEmailStatus();
    if (st.dailyLimitReached) {
      setError("本日の送信回数の上限に達しました。明日以降にお試しください。");
      return;
    }
    if (!st.canResend) {
      setError(`再送はあと${Math.ceil(st.resendWaitMs / 1000)}秒お待ちください。`);
      return;
    }
    setBusy(true);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("not-signed-in");
      await sendVerificationEmail(u);
      setNotice("確認メールを送信しました。メール内のリンクを開いて認証を完了してください。");
    } catch (e) {
      if (e && e.code === "auth/too-many-requests") {
        setError("送信回数が多すぎます。しばらく待ってから再度お試しください。");
      } else if (e && e.code === "auth/requires-recent-login") {
        setError("ログインし直してから、もう一度お試しください。");
      } else {
        setError("確認メールの送信に失敗しました。しばらく待ってから再度お試しください。");
      }
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
        if (updated.emailVerified) {
          /* 確認完了後は ID トークンを強制更新する。reload() だけではトークンが更新されず、
             確認前に発行された古いトークン（email_verified=false）が最大1時間使われ、
             Worker が全 API を 401（email_not_verified）で拒否し続けるため */
          await updated.getIdToken(true).catch(() => {});
        } else {
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
          <p className="muted small">複数の確認メールが届いている場合は、一番新しいメールのリンクを開いてください。古いリンクは使えません。</p>
          <p className="muted small">リンクは1回だけ開き、開いたあとはアプリに戻って「認証が完了したらこちらを押す」を押してください。リンクの画面でエラーが出た場合でも、確認が完了していることがあります。</p>
          {notice && <p className="login-notice" role="status">{notice}</p>}
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="button" className="btn-primary btn-block" onClick={refresh} disabled={busy}>
            {busy ? "確認中…" : "認証が完了したらこちらを押す"}
          </button>
          <div style={{ height: 10 }} />
          <button type="button" className="btn-secondary btn-block" onClick={resend} disabled={busy || dailyLimitReached || resendWaitSec > 0}>
            {dailyLimitReached
              ? "本日の送信上限に達しました"
              : resendWaitSec > 0
                ? `再送できます（あと${resendWaitSec}秒）`
                : "確認メールを再送信する"}
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
