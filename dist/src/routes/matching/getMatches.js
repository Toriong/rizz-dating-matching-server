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
    return { fieldName: key, receivedType };
}
function getQueryOptionsValidationArr(queryOpts) {
    console.log('checking options of query. queryOpts: ', queryOpts);
    const validSexes = ['Male', 'Female'];
    const { userLocation, desiredAgeRange, desiredSex, paginationPageNum, radiusInMilesInt } = queryOpts !== null && queryOpts !== void 0 ? queryOpts : {};
    const { latitude, longitude } = userLocation !== null && userLocation !== void 0 ? userLocation : {};
    const areValsInDesiredAgeRangeArrValid = (Array.isArray(desiredAgeRange) && (desiredAgeRange.length === 2)) && desiredAgeRange.every(date => !Number.isNaN(Date.parse(date)));
    const areDesiredAgeRangeValsValid = { receivedType: typeof desiredAgeRange, recievedTypeOfValsInArr: desiredAgeRange.map(ageDate => typeof ageDate), correctVal: 'object', fieldName: 'desiredAgeRange', isCorrectValType: areValsInDesiredAgeRangeArrValid, val: desiredAgeRange };
    const isLongAndLatValueTypeValid = (!!longitude && !!latitude) && ((typeof parseInt(longitude) === 'number') && (typeof parseInt(latitude) === 'number'));
    const isLongAndLatValid = { receivedType: typeof userLocation, recievedTypeOfValsInArr: Object.keys(userLocation).map(key => validateFormOfObj(key, userLocation)), correctVal: 'number', fieldName: 'userLocation', isCorrectValType: isLongAndLatValueTypeValid, val: userLocation, areFiedNamesPresent: !!latitude && !!longitude };
    const sexValidationObj = { receivedType: typeof validSexes, correctVal: validSexes, fieldName: 'desiredSex', isCorrectValType: validSexes.includes(desiredSex), val: desiredSex };
    const paginationPageNumValidationObj = { receivedType: typeof paginationPageNum, correctVal: 'number', fieldName: 'paginationPageNum', isCorrectValType: typeof parseInt(paginationPageNum) === 'number', val: paginationPageNum };
    const radiusValidationObj = { receivedType: typeof radiusInMilesInt, correctVal: 'number', fieldName: 'radiusInMilesInt', isCorrectValType: typeof parseInt(radiusInMilesInt) === 'number', val: radiusInMilesInt };
    return [radiusValidationObj, paginationPageNumValidationObj, sexValidationObj, isLongAndLatValid, areDesiredAgeRangeValsValid];
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
    let userQueryOpts = query;
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
    const userlocationValsUpdated = { longitude: parseInt(userQueryOpts.userLocation.longitude), latitude: parseInt(userQueryOpts.userLocation.latitude) };
    const dateRangesUpdated = userQueryOpts.desiredAgeRange.map(date => new Date(date));
    const valOfRadiusFieldUpdated = parseInt(userQueryOpts.radiusInMilesInt);
    const paginationPageNumUpdated = parseInt(userQueryOpts.paginationPageNum);
    userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { paginationPageNum: paginationPageNumUpdated, userLocation: userlocationValsUpdated, desiredAgeRange: dateRangesUpdated, radiusInMilesInt: valOfRadiusFieldUpdated });
    console.log('will query for matches...');
    const queryMatchesResults = yield getMatches(userQueryOpts);
    console.log('queryMatchesResults: ', queryMatchesResults);
    const { status, data, msg } = queryMatchesResults;
    const responseBody = (status === 200) ? { potentialMatchesPageInfo: data } : { msg: msg };
    return response.status(status).json(responseBody);
}));
