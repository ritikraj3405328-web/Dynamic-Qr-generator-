// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    increment, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCoKuiUPnPvRsDvvv0fOnK2aUJLqpSOX-Y",
    authDomain: "dynamic-qr-generator-b7401.firebaseapp.com",
    projectId: "dynamic-qr-generator-b7401",
    storageBucket: "dynamic-qr-generator-b7401.firebasestorage.app",
    messagingSenderId: "695794205373",
    appId: "1:695794205373:web:0d268cec5244d70523edd4"
};

// APNA ADMIN EMAIL YAHAN LIKHEIN
export const MASTER_ADMIN_EMAIL = "APNA_ADMIN_EMAIL@gmail.com";

// UPI PAYMENT DETAILS
export const ADMIN_UPI_ID = "9661692365@ybl";
export const ADMIN_MERCHANT_NAME = "SmartQR Pro";
export const PRO_PLAN_PRICE = "499.00";
export const FREE_TRIAL_DAYS = 14;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

export { 
    signInWithPopup, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged, 
    signOut, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    increment, 
    serverTimestamp 
};
