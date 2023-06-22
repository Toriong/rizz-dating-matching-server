import { Router, Request, Response } from 'express'
import { RejectedUserInterface } from "../../types-and-interfaces/interfaces.js";
import { insertRejectedUser } from "../../services/rejectedUsersService.js";
import GLOBAL_VALS from '../../globalVals.js';
import { getMatches } from '../../services/matching/matchesServices.js';

export const getMatchesRoute = Router();

getMatchesRoute.get(`/${GLOBAL_VALS.matchesRootPath}/get-matches`, async (request: Request, response: Response) => {
    // GOAL #1: get the users based on the following criteria:
    // if the user is within the user's location radius
    // if the user is within the user's target age
    // if the user has a high rating  

    // GOAL #2: the following data is received from the client:
    // the id of the user
    // the id of the user will be used for the following:
    // to get their sex preference 
    // to get their age preference
    await getMatches()

    return response.status(200).json({ potentialMatches: [] })
})
