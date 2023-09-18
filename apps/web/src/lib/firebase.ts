import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyC5NivaQBepaTuukr2kbaeAIR9QW7QmDUY",
    authDomain: "banjodraw-4d63e.firebaseapp.com",
    projectId: "banjodraw-4d63e",
    storageBucket: "banjodraw-4d63e.appspot.com",
    messagingSenderId: "363187421088",
    appId: "1:363187421088:web:fc795dddf6be53dfe36ec5",
    measurementId: "G-7T61V0QKVX",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
