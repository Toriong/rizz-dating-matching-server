import express from 'express';
import { insertRouter } from './insertRejectedUsers.js';
import { getRejectedUserRouter } from './getRejectedUsers.js';
import { deleteRejectedUserRoute } from './deleteRejectedUser.js';
import { getMatchesRoute } from './matching/getMatches.js';

export const routes = express.Router();

routes.use(insertRouter);
routes.use(getRejectedUserRouter)
routes.use(deleteRejectedUserRoute)
routes.use(getMatchesRoute)
