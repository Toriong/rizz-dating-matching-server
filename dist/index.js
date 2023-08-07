var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { routes } from './src/routes/index.js';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
dotenv.config();
const app = express();
const { PORT, MONGO_DB_CONNECTION_STR } = process.env;
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const connectionResult = yield mongoose.connect(MONGO_DB_CONNECTION_STR);
        if (connectionResult) {
            console.log(`[mongoose]: Connection to the mongodb database via mongoose was successful!`);
        }
        else {
            throw new Error('Failed to connect to the database via mongoose.');
        }
    }
    catch (error) {
        console.error("Mongoose Error: ", error);
    }
}))();
mongoose.connect(MONGO_DB_CONNECTION_STR).then(() => {
    console.log("[mongoose]: Connection to the mongodb database via mongoose was successful!");
}).catch(error => {
    console.log(`[mongoose]: Error in connecting to DB via mongoose: ${error}`);
});
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:19006"]
}));
app.use("/", routes);
app.listen(PORT, () => {
    console.log(`[server]: The server is live⚡️! Server is running on the following PORT: ${PORT}`);
});
