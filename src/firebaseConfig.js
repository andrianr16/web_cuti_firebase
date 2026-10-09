import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyDNqesgS3b6IhVeDJOoO2h_IumXvBwD4U8",
    authDomain: "web-cuti-lestari.firebaseapp.com",
    projectId: "web-cuti-lestari",
    storageBucket: "web-cuti-lestari.firebasestorage.app",
    messagingSenderId: "350190930164",
    appId: "1:350190930164:web:0ae9d7c6f5a90ba7d3f6a1",
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
export const secondaryAuth = getAuth(secondaryApp);