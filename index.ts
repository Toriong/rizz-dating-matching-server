import express, { Express, Request, Response, Router } from 'express';
import dotenv from 'dotenv';
import cors from 'cors'

// NOTES: 
// this server will handle the following:
// 1. store the rejected user into the database
// 2. will delete the rejected uesr from the database
// 3. for pro members, they have an option to never see the rejected user again

dotenv.config();
const ROOT_API_PATH = 'rejected-users-api'
const app: Express = express();
const { PORT } = process.env;
const insertRejectedUserRoute = require('/src/routes/insert.ts');
const updateRejectedUserRoute = require('/src/routes/update.ts');
const deleteRejectedUserRoute = require('/src/routes/delete.ts');
const getRejectedUserRoute = require('/src/routes/get.ts');

app.use(cors({
  origin: ["http://localhost:19006/", "*"]
}));

app.use(`/${ROOT_API_PATH}/insert-rejected-user`, insertRejectedUserRoute);

app.use(`/${ROOT_API_PATH}/update-rejected-user`, updateRejectedUserRoute);

app.use(`/${ROOT_API_PATH}/delete-rejected-user`, deleteRejectedUserRoute);

app.use(`/${ROOT_API_PATH}/get-rejected-user`, getRejectedUserRoute);

app.get('/', (req: Request, res: Response) => {
  res.send('Server is up and running!');
});


app.listen(PORT, () => {
  console.log(`The server is live⚡️! Server is running at http://localhost:${PORT}`);
});