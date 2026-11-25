/* 確認メールの送信と再送制限。
   対象はメールアドレス＋パスワードで登録した未確認ユーザーのみ。
   確認済みのアカウントには送らない。
   連打・繰り返し送信によるスパムを防ぐため、送信間隔と1日の回数を制限する
   （端末内の localStorage で管理する。Firebase 側の送信制限も別途かかる）。
   ID トークンの更新とは関係なく、Firebase Authentication の確認メール送信のみを扱う。 */
import { sendEmailVerification } from "firebase/auth";

const STORAGE_KEY = "meteor-bookshelf:verifyEmail";
const AUTO_SEND_INTERVAL_MS = 30 * 60 * 1000; // 自動送信は30分に1回まで
const RESEND_COOLDOWN_MS = 60 * 1000; // 手動の再送は60秒に1回まで
const MAX_SENDS_PER_DAY = 5; // 1日あたりの送信回数の上限（自動送信と手動の再送の合計）

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastSentAt: 0, date: todayStr(), count: 0 };
    const s = JSON.parse(raw);
    return { lastSentAt: Number(s.lastSentAt) || 0, date: String(s.date || ""), count: Number(s.count) || 0 };
  } catch (_) {
    return { lastSentAt: 0, date: todayStr(), count: 0 };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* 保存できなくても送信自体は行う */ }
}

/* 送信を記録する。送信の成功時に呼ぶこと */
export function recordVerificationEmailSent() {
  const now = Date.now();
  const today = todayStr();
  const s = loadState();
  const count = s.date === today ? s.count + 1 : 1;
  saveState({ lastSentAt: now, date: today, count });
}

/* 現在の送信可否を返す */
export function getVerificationEmailStatus() {
  const now = Date.now();
  const today = todayStr();
  const s = loadState();
  const sendsToday = s.date === today ? s.count : 0;
  const dailyLimitReached = sendsToday >= MAX_SENDS_PER_DAY;
  const resendWaitMs = Math.max(0, RESEND_COOLDOWN_MS - (now - s.lastSentAt));
  const autoWaitMs = Math.max(0, AUTO_SEND_INTERVAL_MS - (now - s.lastSentAt));
  return {
    lastSentAt: s.lastSentAt,
    sendsToday,
    maxSendsPerDay: MAX_SENDS_PER_DAY,
    dailyLimitReached,
    canResend: !dailyLimitReached && resendWaitMs === 0,
    resendWaitMs,
    canAutoSend: !dailyLimitReached && autoWaitMs === 0,
    autoWaitMs,
  };
}

/* 確認メールを送信する。成功時に送信記録を残す。失敗時は例外を投げる */
export async function sendVerificationEmail(user) {
  await sendEmailVerification(user);
  recordVerificationEmailSent();
}

/* ログイン時に未確認ユーザーへ確認メールを自動送信する。
   対象はメールアドレス＋パスワードの未確認ユーザーのみ。
   送信間隔（30分）と1日の回数上限（5回）を超えている場合は送らない。
   送信できた場合のみ true を返す。失敗時は例外を投げず false を返す */
export async function maybeAutoSendVerificationEmail(fbUser) {
  try {
    if (!fbUser) return false;
    if (fbUser.emailVerified) return false;
    const isPasswordUser = Array.isArray(fbUser.providerData) && fbUser.providerData.some((p) => p.providerId === "password");
    if (!isPasswordUser) return false;
    if (!getVerificationEmailStatus().canAutoSend) return false;
    await sendVerificationEmail(fbUser);
    return true;
  } catch (_) {
    return false;
  }
}
