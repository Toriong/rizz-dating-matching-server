import { initializeApp } from "firebase/app";
import { getDatabase, set, get, remove, ref, child } from "firebase/database";
import dotenv from 'dotenv';



function getFirebaseInfo() {
    dotenv.config();

    const { FIREBASE_APP_ID, FIREBASE_PROJECT_ID, FIREBASE_DB_URL } = process.env;
    const app = initializeApp({ databaseURL: FIREBASE_DB_URL, projectId: FIREBASE_PROJECT_ID, appId: FIREBASE_APP_ID });
    const db = getDatabase(app);
    return { db, set, get, remove, ref, child }
}

export default getFirebaseInfo;