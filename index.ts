import { routes } from './src/routes/index.js';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'
import mongoose from 'mongoose';
import ip from 'ip'

const IP_ADDRESS = ip.address()

dotenv.config();

const app = express();
const { MONGO_DB_CONNECTION_STR } = process.env;
let PORT = process.env.PORT || 5000;

(async () => {
  try {
    const connectionResult = await mongoose.connect(MONGO_DB_CONNECTION_STR as string)

    if (connectionResult) {
      console.log(`[mongoose]: Connection to the mongodb database via mongoose was successful!`)
    } else {
      throw new Error('Failed to connect to the database via mongoose.')
    }
  } catch (error) {
    console.error("Mongoose Error: ", error)
  }
})();

app.use(express.json());

app.use(cors({
  origin: ["http://localhost:19006"]
}));

app.get('/', (request, response) => {
  response.send("The server is live! YO!")
})

app.use("/", routes);

PORT = (typeof PORT === 'string') ? parseInt(PORT) : PORT;

console.log('IP_ADDRESS: ', IP_ADDRESS)

app.listen(PORT, IP_ADDRESS, () => {
  console.log(`[server]: The server is live⚡️! Server is running on the following PORT: ${PORT}`);
})