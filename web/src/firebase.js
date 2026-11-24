/* Firebase Authentication 初期化。
   設定値は公開情報（Webアプリ設定）のためフロントに埋め込んでよい。 */
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDBoddinUN1Gnq3k7JVGCwTLWCFM4QxWyQ",
  authDomain: "meteor-bookshelf.firebaseapp.com",
  projectId: "meteor-bookshelf",
  storageBucket: "meteor-bookshelf.firebasestorage.app",
  messagingSenderId: "99848180767",
  appId: "1:99848180767:web:606ef7b0b1b825d0de712a",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
