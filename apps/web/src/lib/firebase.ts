import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCn-wpkNDt6tm04-wKmrOl0BGUcqDo4iGc",
    authDomain: "banjo-draw.firebaseapp.com",
    projectId: "banjo-draw",
    storageBucket: "banjo-draw.appspot.com",
    messagingSenderId: "109015338205",
    appId: "1:109015338205:web:b74553cfa82990a31adf34",
    measurementId: "G-DQTP9D16Z9",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
