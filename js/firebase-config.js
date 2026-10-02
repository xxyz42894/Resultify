// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";

// Firebase Web App Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDfnrWk4z7cTy11NUngLnxAPvRF1ckYCcQ",
  authDomain: "resutify-demo.firebaseapp.com",
  databaseURL: "https://resutify-demo-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "resutify-demo",
  storageBucket: "resutify-demo.firebasestorage.app",
  messagingSenderId: "495384653368",
  appId: "1:495384653368:web:40202f4aeedec32b4600cd",
  measurementId: "G-28Z2BTQTZ0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const analytics = getAnalytics(app);

export { app, auth, database, analytics };
