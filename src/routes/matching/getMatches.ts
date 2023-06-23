import { Router, Request, Response } from 'express'
import { insertRejectedUser } from "../../services/rejectedUsersService.js";
import GLOBAL_VALS from '../../globalVals.js';
import { getMatches } from '../../services/matching/matchesServices.js';
import { UserQueryOpts } from '../../types-and-interfaces/interfaces/userQueryInterfaces.js';

export const getMatchesRoute = Router();

function checkIfQueryOptsAreValid(queryOpts: UserQueryOpts): boolean {
    const validSexes = ['Male', 'Female']
    const { userLocation, desiredAgeRange, desiredSex, paginationPageNum, radiusInMilesInt } = queryOpts ?? {}
    const { latitude, longitude } = userLocation ?? {};
    const isUserLocationValid = (!!latitude && !!longitude) && (typeof latitude === 'number') && (typeof longitude === 'number');
    const isDesiredAgeRangeValid = Array.isArray(desiredAgeRange) && (desiredAgeRange.length === 2) && desiredAgeRange.every(date => date instanceof Date);
    const isDesireSexValid = !!desiredSex && validSexes.includes(desiredSex);
    const isPaginationPageNumValid = !!paginationPageNum && (typeof paginationPageNum === 'number');
    const isRadisusInMilesInt = !!radiusInMilesInt && (typeof radiusInMilesInt === 'number');


    return isUserLocationValid && isDesiredAgeRangeValid && isDesireSexValid && isPaginationPageNumValid && isRadisusInMilesInt;
}

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

    // brain dump:
    // check for the following the parameters of the request: 
    // desiredSex, userLocation, radiusInMilesInt, desiredAgeRange, paginationPageNum
    // if any of the parameters are missing, return an error message
    // if all of the parameters are present, then proceed to get the matches
    const query: unknown = request.query

    console.log('query: ', query)

    if (query === undefined || !query) {
        return response.status(400).json({ msg: 'Missing query parameters.' })
    }

    const userQueryOpts = query as UserQueryOpts;
    const isQueryOptsValid = checkIfQueryOptsAreValid(userQueryOpts);

    console.log('isQueriyOptsValid: ', isQueryOptsValid)

    if(!isQueryOptsValid){
        console.error('An errror has occurred. Invalid query parameters.')
        return response.status(400).json({ msg: 'Invalid query parameters.' })
    }

    console.log("Will get the user's matches and send them to the client.")

    const queryMatchesResults = await getMatches(userQueryOpts);
    
    console.log('queryMatchesResults: ', queryMatchesResults)

    const { status, data, msg } = queryMatchesResults;
    const responseBody = (status === 200) ? { potentialMatchesPageInfo: data } : { msg: msg }

    return response.status(status).json(responseBody)
})
