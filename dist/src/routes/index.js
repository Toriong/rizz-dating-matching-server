import express from 'express';
import { insertRouter } from './insert.js';
import { getRejectedUserRouter } from './getRejectedUsers.js';
import { deleteRejectedUserRoute } from './deleteRejectedUser.js';
export const routes = express.Router();
routes.use(insertRouter);
routes.use(getRejectedUserRouter);
routes.use(deleteRejectedUserRoute);
