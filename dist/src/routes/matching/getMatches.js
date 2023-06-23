var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Router } from 'express';
import GLOBAL_VALS from '../../globalVals.js';
import { getMatches } from '../../services/matching/matchesServices.js';
export const getMatchesRoute = Router();
function checkIfQueryOptsAreValid(queryOpts) {
    const validSexes = ['Male', 'Female'];
    const { userLocation, desiredAgeRange, desiredSex, paginationPageNum, radiusInMilesInt } = queryOpts !== null && queryOpts !== void 0 ? queryOpts : {};
    const { latitude, longitude } = userLocation !== null && userLocation !== void 0 ? userLocation : {};
    const isUserLocationValid = (!!latitude && !!longitude) && (typeof latitude === 'number') && (typeof longitude === 'number');
    const isDesiredAgeRangeValid = Array.isArray(desiredAgeRange) && (desiredAgeRange.length === 2) && desiredAgeRange.every(date => date instanceof Date);
    const isDesireSexValid = !!desiredSex && validSexes.includes(desiredSex);
    const isPaginationPageNumValid = !!paginationPageNum && (typeof paginationPageNum === 'number');
    const isRadisusInMilesInt = !!radiusInMilesInt && (typeof radiusInMilesInt === 'number');
    return isUserLocationValid && isDesiredAgeRangeValid && isDesireSexValid && isPaginationPageNumValid && isRadisusInMilesInt;
}
getMatchesRoute.get(`/${GLOBAL_VALS.matchesRootPath}/get-matches`, (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
    const query = request.query;
    console.log('query: ', query);
    if (query === undefined || !query) {
        return response.status(400).json({ msg: 'Missing query parameters.' });
    }
    const userQueryOpts = query;
    const isQueryOptsValid = checkIfQueryOptsAreValid(userQueryOpts);
    console.log('isQueriyOptsValid: ', isQueryOptsValid);
    if (!isQueryOptsValid) {
        return response.status(400).json({ msg: 'Invalid query parameters.' });
    }
    const queryMatchesResults = yield getMatches(userQueryOpts);
    const { status, data, msg } = queryMatchesResults;
    const responseBody = (status === 200) ? { potentialMatchesPageInfo: data } : { msg: msg };
    return response.status(status).json(responseBody);
}));
