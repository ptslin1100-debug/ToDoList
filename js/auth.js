// js/auth.js
// Google 登入驗證與使用者狀態管理

import {
  initFirebase,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  serverTimestamp
} from "./firebase-config.js";

let currentUser = null;
let authListenerUnsubscribe = null;

// 將 Firebase Auth 錯誤碼轉換為親切的繁體中文提示
export function formatAuthError(error) {
  if (!error) return "發生未知錯誤";
  const code = error.code || "";
  
  switch (code) {
    case "auth/popup-blocked":
      return "瀏覽器已封鎖快顯視窗，請允許此網站開啟快顯視窗後重試。";
    case "auth/popup-closed-by-user":
      return "登入視窗已提早關閉，請重新點選登入。";
    case "auth/unauthorized-domain":
      return "此網址尚未加入 Firebase 授權網域！請至 Firebase 控制台 > Authentication > Settings > Authorized domains 加入當前主機網址（例如 localhost 或 127.0.0.1）。";
    case "auth/operation-not-allowed":
      return "專案尚未啟用 Google 登入！請至 Firebase 控制台 > Authentication > Sign-in method 啟用「Google」登入提供者。";
    case "auth/network-request-failed":
      return "網路連線失敗，請確認您的網路連線狀態。";
    case "auth/invalid-api-key":
      return "Firebase API Key 無效，請檢查 Firebase 設定。";
    default:
      return error.message || "登入失敗，請稍後重試。";
  }
}

// 同步使用者資料到 Firestore 的 users 集合，方便多人協作查詢頭像與姓名
async function syncUserProfile(user, db) {
  if (!user || !db) return;
  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || "匿名成員",
      email: user.email || "",
      photoURL: user.photoURL || "",
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn("同步使用者資料至 Firestore 失敗 (可能尚未建立 Firestore 規則):", err);
  }
}

// 監聽登入狀態改變
export function subscribeToAuth(callback) {
  const { auth, db, isReady } = initFirebase();
  if (!isReady || !auth) {
    callback(null, false);
    return () => {};
  }

  // 處理可能的重定向結果 (若有使用 redirect)
  getRedirectResult(auth).catch(err => {
    console.warn("Redirect result error:", err);
  });

  if (authListenerUnsubscribe) {
    authListenerUnsubscribe();
  }

  authListenerUnsubscribe = onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user && db) {
      await syncUserProfile(user, db);
    }
    callback(user, true);
  });

  return authListenerUnsubscribe;
}

// 執行 Google 登入
export async function loginWithGoogle() {
  const { auth, db, isReady } = initFirebase();
  if (!isReady || !auth) {
    throw new Error("Firebase 尚未正確設定，請先點擊右上角「Firebase 設定」填入 API Key！");
  }

  const provider = new GoogleAuthProvider();
  // 強制提示帳號選擇
  provider.setCustomParameters({
    prompt: "select_account"
  });

  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    if (db && currentUser) {
      await syncUserProfile(currentUser, db);
    }
    return currentUser;
  } catch (error) {
    console.error("Google 登入錯誤:", error);
    // 若因特定瀏覽器安全設定無法使用 popup，提示或嘗試 redirect
    if (error.code === "auth/popup-blocked") {
      console.warn("Popup blocked, attempting redirect...");
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}

// 執行登出
export async function logout() {
  const { auth, isReady } = initFirebase();
  if (!isReady || !auth) {
    currentUser = null;
    return;
  }
  await signOut(auth);
  currentUser = null;
}

// 取得當前已登入的使用者物件
export function getCurrentUser() {
  return currentUser;
}
