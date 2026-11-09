// js/firebase-config.js
// Firebase 模組化 SDK (v10.12.2) 導入與設定管理

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  getDoc,
  getDocs,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  arrayUnion, 
  arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 預設專案設定（專案 ID: to-do-list-511f9）
// 若您尚未在下方填寫 apiKey 與 appId，可直接在網頁介面上的「Firebase 設定」彈窗輸入並儲存！
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "", 
  authDomain: "to-do-list-511f9.firebaseapp.com",
  projectId: "to-do-list-511f9",
  storageBucket: "to-do-list-511f9.appspot.com",
  messagingSenderId: "",
  appId: ""
};

const STORAGE_KEY = "todolist_firebase_config_override";

// 取得當前生效的 Firebase 設定 (優先採用 localStorage，無則使用預設值)
export function getFirebaseConfig() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_FIREBASE_CONFIG, ...parsed, projectId: "to-do-list-511f9" };
    } catch (e) {
      console.warn("無法解析儲存的 Firebase 設定:", e);
    }
  }
  return { ...DEFAULT_FIREBASE_CONFIG };
}

// 儲存新的 Firebase 設定
export function saveFirebaseConfig(config) {
  const cleanConfig = {
    apiKey: (config.apiKey || "").trim(),
    authDomain: (config.authDomain || "to-do-list-511f9.firebaseapp.com").trim(),
    projectId: "to-do-list-511f9",
    storageBucket: (config.storageBucket || "to-do-list-511f9.appspot.com").trim(),
    messagingSenderId: (config.messagingSenderId || "").trim(),
    appId: (config.appId || "").trim()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanConfig));
  return cleanConfig;
}

// 清除自訂設定，恢復預設
export function resetFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

// 檢查是否已設定 API Key
export function isFirebaseConfigured() {
  const config = getFirebaseConfig();
  return Boolean(config.apiKey && config.apiKey.length > 10 && config.projectId);
}

let app = null;
let auth = null;
let db = null;

// 初始化 Firebase 實例
export function initFirebase() {
  const config = getFirebaseConfig();

  if (!config.apiKey) {
    console.warn("尚未設定 Firebase API Key，請在設定彈窗中填入。");
    return { app: null, auth: null, db: null, isReady: false };
  }

  try {
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    db = getFirestore(app);
    return { app, auth, db, isReady: true };
  } catch (err) {
    console.error("Firebase 初始化失敗:", err);
    return { app: null, auth: null, db: null, isReady: false, error: err };
  }
}

// 匯出 SDK 常用方法
export {
  app,
  auth,
  db,
  // Auth
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  // Firestore
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove
};
