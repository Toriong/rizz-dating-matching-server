import express, { Express, Request, Response, Router } from 'express';
import dotenv from 'dotenv';
import cors from 'cors'
import { createRequire } from 'module'


// NOTES: 
// this server will handle the following:
// 1. store the rejected user into the database
// 2. will delete the rejected uesr from the database
// 3. for pro members, they have an option to never see the rejected user again

dotenv.config();
const ROOT_API_PATH = 'rejected-users-api'
const app: Express = express();
const { PORT } = process.env;
const insertRejectedUserRoute = createRequire('/src/routes/insert.ts');
const updateRejectedUserRoute = createRequire('/src/routes/update.ts');
const deleteRejectedUserRoute = createRequire('/src/routes/delete.ts');
const getRejectedUserRoute = createRequire('/src/routes/get.ts');

app.use(cors({
  origin: ["http://localhost:19006/", "*"]
}));

app.use(`/${ROOT_API_PATH}/insert`, insertRejectedUserRoute);

app.use(`/${ROOT_API_PATH}/put`, updateRejectedUserRoute);

app.use(`/${ROOT_API_PATH}/delete`, deleteRejectedUserRoute);

app.use(`/${ROOT_API_PATH}/get`, getRejectedUserRoute);

app.get('/', (req: Request, res: Response) => {
  console.log('Received a request!')
  res.send('Server is up and running!');
});


app.listen(PORT, () => {
  console.log(`The server is live⚡️! Server is running at http://localhost:${PORT}`);
});