/**
 * Firebase 配置文件
 * 
 * 设置步骤：
 * 1. 打开 https://console.firebase.google.com
 * 2. 创建项目 → Database → Firestore → 创建数据库（选择"测试模式"）
 * 3. 项目设置 → 常规 → 你的应用 → Web 应用 → 复制 firebaseConfig
 * 4. 替换下面的占位值
 */

const firebaseConfig = {
  apiKey: "AIzaSyDF4QSa9q8Tum0nj8g95g-6jMtzEyE2g6Y",
  authDomain: "picture-93a21.firebaseapp.com",
  projectId: "picture-93a21",
  storageBucket: "picture-93a21.firebasestorage.app",
  messagingSenderId: "506117452932",
  appId: "1:506117452932:web:46ab8a8cb1fda21942bed1"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();