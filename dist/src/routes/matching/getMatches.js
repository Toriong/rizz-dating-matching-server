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
function validateFormOfObj(key, obj) {
    const receivedType = typeof obj[key];
    return { fieldName: key, receivedType: receivedType };
}
function getQueryOptionsValidationArr(queryOpts) {
    console.log('checking options of query. queryOpts: ', queryOpts);
    const validSexes = ['Male', 'Female'];
    const { userLocation, desiredAgeRange, skipDocsNum, radiusInMilesInt } = queryOpts !== null && queryOpts !== void 0 ? queryOpts : {};
    console.log('desiredAgeRange: ', desiredAgeRange);
    const { latitude, longitude } = userLocation !== null && userLocation !== void 0 ? userLocation : {};
    const areValsInDesiredAgeRangeArrValid = (Array.isArray(desiredAgeRange) && (desiredAgeRange.length === 2)) && desiredAgeRange.every(date => !Number.isNaN(Date.parse(date)));
    const areDesiredAgeRangeValsValid = { receivedType: typeof desiredAgeRange, recievedTypeOfValsInArr: desiredAgeRange.map(ageDate => typeof ageDate), correctVal: 'object', fieldName: 'desiredAgeRange', isCorrectValType: areValsInDesiredAgeRangeArrValid, val: desiredAgeRange };
    const isLongAndLatValueTypeValid = (!!longitude && !!latitude) && ((typeof parseFloat(longitude) === 'number') && (typeof parseFloat(latitude) === 'number'));
    const isLongAndLatValid = { receivedType: typeof userLocation, recievedTypeOfValsInArr: Object.keys(userLocation).map(key => validateFormOfObj(key, userLocation)), correctVal: 'number', fieldName: 'userLocation', isCorrectValType: isLongAndLatValueTypeValid, val: userLocation, areFiedNamesPresent: !!latitude && !!longitude };
    const paginationPageNumValidationObj = { receivedType: typeof skipDocsNum, correctVal: 'number', fieldName: 'skipDocsNum', isCorrectValType: typeof parseInt(skipDocsNum) === 'number', val: skipDocsNum };
    const radiusValidationObj = { receivedType: typeof radiusInMilesInt, correctVal: 'number', fieldName: 'radiusInMilesInt', isCorrectValType: typeof parseInt(radiusInMilesInt) === 'number', val: radiusInMilesInt };
    return [radiusValidationObj, paginationPageNumValidationObj, isLongAndLatValid, areDesiredAgeRangeValsValid];
}
getMatchesRoute.get(`/${GLOBAL_VALS.matchesRootPath}/get-matches`, (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    let query = request.query;
    console.log('get matches for user on the client-side query: ', query);
    if (!query || !(query === null || query === void 0 ? void 0 : query.query) || !query.userId) {
        return response.status(400).json({ msg: 'Missing query parameters.' });
    }
    // query will receive the following: { query: this will be all of the query options, userId: the id of the user that is making the request }
    let userQueryOpts = query.query;
    console.log("userQueryOpts: ", userQueryOpts);
    console.log('userQueryOpts desiredAgeRange: ', userQueryOpts.desiredAgeRange);
    const queryOptsValidArr = getQueryOptionsValidationArr(userQueryOpts);
    const areQueryOptsValid = queryOptsValidArr.every(queryValidationObj => queryValidationObj.isCorrectValType);
    // filter in all of the query options validtion results with the field of isCorrectValType of false
    if (!areQueryOptsValid) {
        const invalidQueryOpts = queryOptsValidArr.filter(({ isCorrectValType }) => !isCorrectValType);
        console.table(invalidQueryOpts);
        console.error('An errror has occurred. Invalid query parameters.');
        return response.status(400).json({ msg: 'Invalid query parameters.' });
    }
    console.log("Will get the user's matches and send them to the client.");
    // access the userQuerOpts.desireDateRange, loop through it using the map method, and change the date strings to date objects
    const userlocationValsUpdated = { longitude: parseFloat(userQueryOpts.userLocation.longitude), latitude: parseFloat(userQueryOpts.userLocation.latitude) };
    const valOfRadiusFieldUpdated = parseInt(userQueryOpts.radiusInMilesInt);
    const paginationPageNumUpdated = parseInt(userQueryOpts.skipDocsNum);
    userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: paginationPageNumUpdated, userLocation: userlocationValsUpdated, radiusInMilesInt: valOfRadiusFieldUpdated });
    console.log('will query for matches...');
    const queryMatchesResults = yield getMatches(userQueryOpts, query.userId);
    const { status, data, msg } = queryMatchesResults;
    // BRAIN DUMP: 
    // create a recursive function that will get the user's prompts from the database
    // after the checking if the user has any prompts in the database, and if at least one user do not have any prompts then call a recursive function that will get the users with prompts from the database 
    // the above function will do the following:
    // get the users with propmts from the database
    // will check if the user has any prompts in the db
    // if no prompts, then call the function again
    // else, return the result of the query for this function
    // the function will get the number of users that do have prompts 
    // the current page number that the user is on (the amount of users that has been skipped already)
    // check if the current page has any querable users
    // CASE: after querying for the user's prompts, at least one user has not prompts in the db.
    // GOAL: make another querying into the database in order to get prompts of users who do have prompts
    // GOAL #2: the logic that gets the user's prompts from the database is executed and the results are received
    // CASE: all of the users that were queried do not have any prompts
    // the results are received. In this case, all of the user has no prompts to display to the user on the client side.
    // the results from querying the prompts collection is executed and the results are received.
    // using the ids of the user, get the prompts of the users
    // get all of the userIds of the matches 
    const responseBody = (status === 200) ? { potentialMatchesPagination: data } : { msg: msg };
    return response.status(status).json(responseBody);
}));
