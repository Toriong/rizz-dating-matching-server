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
import { getMatches } from '../../services/matching/matchesQueryServices.js';
import { filterUsersWithoutPrompts, getPromptsImgUrlsAndUserInfo, getPromptsAndPicUrlsOfUsersAfterPicUrlOrPromptsRetrievalHasFailed, getUsersWithPrompts } from '../../services/matching/userMatchesInfoRetrievalServices.js';
export const getMatchesRoute = Router();
function validateFormOfObj(key, obj) {
    const receivedType = typeof obj[key];
    return { fieldName: key, receivedType: receivedType };
}
function getAreValsInArrayValid(arr, targetLength, valueValidationFn, dataTypeInArrStr) {
    return Array.isArray(arr) && (arr.length === targetLength) && arr.every(val => valueValidationFn(val));
}
function getQueryOptionsValidationArr(queryOpts) {
    console.log('checking options of query. queryOpts: ', queryOpts);
    const validSexes = ['Male', 'Female'];
    const { userLocation, desiredAgeRange, skipDocsNum, minAndMaxDistanceArr } = queryOpts !== null && queryOpts !== void 0 ? queryOpts : {};
    console.log('desiredAgeRange: ', desiredAgeRange);
    const { latitude, longitude } = userLocation !== null && userLocation !== void 0 ? userLocation : {};
    const areValsInDesiredAgeRangeArrValid = (Array.isArray(desiredAgeRange) && (desiredAgeRange.length === 2)) && desiredAgeRange.every(date => !Number.isNaN(Date.parse(date)));
    const areValsInMinAndMaxQueryDistanceArrValid = (Array.isArray(desiredAgeRange) && (desiredAgeRange.length === 2)) && desiredAgeRange.every(date => !Number.isNaN(Date.parse(date)));
    const areDesiredAgeRangeValsValid = { receivedType: typeof desiredAgeRange, recievedTypeOfValsInArr: desiredAgeRange.map(ageDate => typeof ageDate), correctVal: 'object', fieldName: 'desiredAgeRange', isCorrectValType: areValsInDesiredAgeRangeArrValid, val: desiredAgeRange };
    const isLongAndLatValueTypeValid = (!!longitude && !!latitude) && ((typeof parseFloat(longitude) === 'number') && (typeof parseFloat(latitude) === 'number'));
    const isLongAndLatValid = { receivedType: typeof userLocation, recievedTypeOfValsInArr: Object.keys(userLocation).map(key => validateFormOfObj(key, userLocation)), correctVal: 'number', fieldName: 'userLocation', isCorrectValType: isLongAndLatValueTypeValid, val: userLocation, areFiedNamesPresent: !!latitude && !!longitude };
    const paginationPageNumValidationObj = { receivedType: typeof skipDocsNum, correctVal: 'number', fieldName: 'skipDocsNum', isCorrectValType: typeof parseInt(skipDocsNum) === 'number', val: skipDocsNum };
    const minAndMaxDistanceQueryArrValidationObj = { receivedType: typeof minAndMaxDistanceArr, correctVal: 'number', fieldName: 'radiusInMilesInt', val: minAndMaxDistanceArr, isCorrectValType: areValsInMinAndMaxQueryDistanceArrValid };
    return [minAndMaxDistanceQueryArrValidationObj, paginationPageNumValidationObj, isLongAndLatValid, areDesiredAgeRangeValsValid];
}
getMatchesRoute.get(`/${GLOBAL_VALS.matchesRootPath}/get-matches`, (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    console.time('getMatchesRoute');
    let query = request.query;
    if (!query || !(query === null || query === void 0 ? void 0 : query.query) || !query.userId) {
        return response.status(400).json({ msg: 'Missing query parameters.' });
    }
    // BRAIN DUMP:
    // userLocationArr will be an array of floats
    // minAndMaxDistanceArr will be an array of numbers   
    let userQueryOpts = query.query;
    const queryOptsValidArr = getQueryOptionsValidationArr(userQueryOpts);
    const areQueryOptsValid = queryOptsValidArr.every(queryValidationObj => queryValidationObj.isCorrectValType);
    if (!areQueryOptsValid) {
        const invalidQueryOpts = queryOptsValidArr.filter(({ isCorrectValType }) => !isCorrectValType);
        console.table(invalidQueryOpts);
        console.error('An errror has occurred. Invalid query parameters.');
        return response.status(400).json({ msg: 'Invalid query parameters.' });
    }
    console.log("Will get the user's matches and send them to the client.");
    const userlocationValsUpdated = { longitude: parseFloat(userQueryOpts.userLocation.longitude), latitude: parseFloat(userQueryOpts.userLocation.latitude) };
    const paginationPageNumUpdated = parseInt(userQueryOpts.skipDocsNum);
    if ((_a = userQueryOpts === null || userQueryOpts === void 0 ? void 0 : userQueryOpts.minAndMaxDistanceArr) === null || _a === void 0 ? void 0 : _a.length) {
        userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: paginationPageNumUpdated, userLocation: userlocationValsUpdated, minAndMaxDistanceArr: userQueryOpts.minAndMaxDistanceArr });
    }
    // if the user wants to query to by the radius set to anywhere, then add that field to the query options object
    // when the user querys based on the radius set to anywhere, then field of the userLocation will be uploaded to the server
    // for checks, the userLocation and the minAndMqxMileQueryArr will be option 
    if (userQueryOpts.isRadiusSetToAnywhere) {
        userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: paginationPageNumUpdated, isRadiusSetToAnywhere: true });
    }
    console.log('will query for matches...');
    const queryMatchesResults = yield getMatches(userQueryOpts, query.userId);
    if (!queryMatchesResults.data || !((_b = queryMatchesResults === null || queryMatchesResults === void 0 ? void 0 : queryMatchesResults.data) === null || _b === void 0 ? void 0 : _b.potentialMatches) || (queryMatchesResults.status !== 200)) {
        console.error("Something went wrong. Couldn't get matches from the database. Message from query result: ", queryMatchesResults.msg);
        console.error('Error status code: ', queryMatchesResults.status);
        return response.status(queryMatchesResults.status).json({ msg: "Something went wrong. Couldnt't matches." });
    }
    const { potentialMatches: getMatchesResultPotentialMatches, hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, updatedSkipDocsNum } = queryMatchesResults.data;
    let { errMsg, potentialMatches: filterUsersWithoutPromptsPotentialMatches, prompts } = yield filterUsersWithoutPrompts(getMatchesResultPotentialMatches);
    console.log("filterUsersWithoutPrompts function has been executed. Will check if there was an error.");
    if (errMsg) {
        console.error("An error has occurred in filtering out users without prompts. Error msg: ", errMsg);
        return response.status(500).json({ msg: `Error! Something went wrong. Couldn't get prompts for users. Error msg: ${errMsg}` });
    }
    let getUsersWithPromptsResult = { potentialMatches: filterUsersWithoutPromptsPotentialMatches, prompts };
    // at least one user doesn't have any prompts in the db
    if (filterUsersWithoutPromptsPotentialMatches.length < 5) {
        console.log('At least one user does not have any prompts in the db. Will get users with prompts from the database.');
        const updatedSkipDocNumInt = (typeof queryMatchesResults.data.updatedSkipDocsNum === 'string') ? parseInt(queryMatchesResults.data.updatedSkipDocsNum) : queryMatchesResults.data.updatedSkipDocsNum;
        const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: queryMatchesResults.data.canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) });
        getUsersWithPromptsResult = yield getUsersWithPrompts(_userQueryOpts, query.userId, filterUsersWithoutPromptsPotentialMatches);
    }
    let potentialMatchesToDisplayToUserOnClient = getUsersWithPromptsResult.potentialMatches;
    let responseBody = { potentialMatchesPagination: Object.assign(Object.assign({}, queryMatchesResults.data), { potentialMatches: potentialMatchesToDisplayToUserOnClient }) };
    if ((potentialMatchesToDisplayToUserOnClient.length === 0)) {
        return response.status(200).json(responseBody);
    }
    console.log('Getting matches info for client...');
    const potentialMatchesForClientResult = yield getPromptsImgUrlsAndUserInfo(potentialMatchesToDisplayToUserOnClient, getUsersWithPromptsResult.prompts);
    responseBody.potentialMatchesPagination.potentialMatches = potentialMatchesForClientResult.potentialMatches;
    console.log('Potential matches info has been retrieved. Will check if the user has valid pic urls.');
    // create a manual get request in the caritas application front end 
    // at least one user does not have a valid url matching pic stored in aws s3 or does not have any prompts stored in the db. 
    if ((potentialMatchesForClientResult.potentialMatches.length < 5) && !hasReachedPaginationEnd) {
        console.log("potentialMatchesForClientResult.potentialMatches: ", potentialMatchesForClientResult.potentialMatches);
        console.log("At least one user does not have a valid url matching pic stored in aws s3 or does not have any prompts stored in the db.");
        const updatedSkipDocNumInt = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;
        const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) });
        const getMoreUsersAfterPicUrlFailureResult = yield getPromptsAndPicUrlsOfUsersAfterPicUrlOrPromptsRetrievalHasFailed(_userQueryOpts, query.userId, potentialMatchesForClientResult.usersWithValidUrlPics);
        console.log("getMoreUsersAfterPicUrlFailureResult.potentialMatches: ", getMoreUsersAfterPicUrlFailureResult.potentialMatches);
        if (!getMoreUsersAfterPicUrlFailureResult.matchesQueryPage) {
            console.error("Something went wrong. Couldn't get the matches query page object. Will send the available potential matches to the client.");
            return response.status(200).json(responseBody);
        }
        if (getMoreUsersAfterPicUrlFailureResult.errorMsg) {
            console.error("Failed to get more users with valid pic urls. Sending current matches that have valid pic aws urls. Error message: ", getMoreUsersAfterPicUrlFailureResult.errorMsg);
            responseBody = { potentialMatchesPagination: Object.assign(Object.assign({}, getMoreUsersAfterPicUrlFailureResult.matchesQueryPage), { potentialMatches: potentialMatchesForClientResult.potentialMatches }) };
            return response.status(200).json(responseBody);
        }
        if ((_c = getMoreUsersAfterPicUrlFailureResult.potentialMatches) === null || _c === void 0 ? void 0 : _c.length) {
            console.log("Potential matches received after at least one user did not have valid prompts or a matching pic url. Will send them to the client.");
            responseBody = { potentialMatchesPagination: Object.assign(Object.assign({}, getMoreUsersAfterPicUrlFailureResult.matchesQueryPage), { potentialMatches: getMoreUsersAfterPicUrlFailureResult.potentialMatches }) };
        }
        if (!((_d = getMoreUsersAfterPicUrlFailureResult.potentialMatches) === null || _d === void 0 ? void 0 : _d.length) || !getMoreUsersAfterPicUrlFailureResult.potentialMatches) {
            console.log('No potential matches to display to the user on the client side.');
            responseBody = { potentialMatchesPagination: Object.assign(Object.assign({}, getMoreUsersAfterPicUrlFailureResult.matchesQueryPage), { potentialMatches: [] }) };
        }
    }
    console.timeEnd('getMatchesRoute');
    console.log("Potential matches has been retrieved. Will send them to the client.");
    return response.status(200).json(responseBody);
}));
