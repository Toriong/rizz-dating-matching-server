import { routes } from './src/routes/index.js';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'
import mongoose from 'mongoose';
import ip from 'ip';

dotenv.config();

const app = express();
const { PORT, MONGO_DB_CONNECTION_STR } = process.env;

(async () => {
  try {
    const connectionResult = await mongoose.connect(MONGO_DB_CONNECTION_STR as string)

    if(connectionResult){
      console.log(`[mongoose]: Connection to the mongodb database via mongoose was successful!`)
    } else { 
      throw new Error('Failed to connect to the database via mongoose.')
    }
  } catch (error) {
    console.error("Mongoose Error: ", error)
  }
})()

mongoose.connect(MONGO_DB_CONNECTION_STR as string).then(() => {
  console.log("[mongoose]: Connection to the mongodb database via mongoose was successful!")
}).catch(error => {
  console.log(`[mongoose]: Error in connecting to DB via mongoose: ${error}`)
});

app.use(express.json());

app.use(cors({
  origin: ["http://localhost:19006"]
}));

app.use("/", routes);

app.listen(PORT, () => {
  console.log(`[server]: The server is live⚡️! Server is running on the following PORT: ${PORT}`);
});