import { Router, Request, Response } from 'express'
import { RejectedUserInterface } from "../../types-and-interfaces/interfaces.js";
import { insertRejectedUser } from "../../services/rejectedUsersService.js";
import GLOBAL_VALS from '../../globalVals.js';
import { getMatches } from '../../services/matching/matchesServices.js';

export const getMatchesRoute = Router();

getMatchesRoute.get(`/${GLOBAL_VALS.matchesRootPath}/get-matches`, async (request: Request, response: Response) => {
    await getMatches()

    return response.status(200).json({ potentialMatches: [] })
})
