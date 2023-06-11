import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { routes } from './src/routes/index.js';
import mongoose from 'mongoose';
dotenv.config();
const app = express();
const { PORT, MONGO_DB_CONNECTION_STR } = process.env;
mongoose.connect(MONGO_DB_CONNECTION_STR).then(() => {
    console.log("Connection to the mongodb database via mongoose was successful!");
}).catch(error => {
    console.log(`Error in connecting to DB via mongoose: ${error}`);
});
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:19006"]
}));
app.use("/", routes);
app.listen(PORT, () => {
    console.log(`The server is live⚡️! Server is running at http://localhost:${PORT}`);
});
