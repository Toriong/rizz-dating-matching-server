import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

// NOTES: 
// this server will handle the following:
// 1. store the rejected user into the database
// 2. will delete the rejected uesr from the database
// 3. for pro members, they have an option to never see the rejected user again

dotenv.config();

const app: Express = express();
const { PORT } = process.env;

// GOAL MAIN: store the rejected user into the database

// GOAL #2: create a service that will store all of the rejected users into the db

// GOAL #3: create a routes in this file that will route the request to the designated service

app.get('/', (req: Request, res: Response) => {
  res.send('Server is up and running!');
});

app.listen(PORT, () => {
  console.log(`The server is live⚡️! Server is running at http://localhost:${PORT}`);
});