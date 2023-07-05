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
import { filterUsersWithoutPrompts, getMatchesInfoForClient, getPromptsAndPicUrlsOfUsersAfterPicUrlRetrievalFailure, getUsersWithPrompts } from '../../services/matching/userMatchesInfoRetrievalServices.js';
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
    var _a, _b;
    console.time('getMatchesRoute');
    let query = request.query;
    if (!query || !(query === null || query === void 0 ? void 0 : query.query) || !query.userId) {
        return response.status(400).json({ msg: 'Missing query parameters.' });
    }
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
    const valOfRadiusFieldUpdated = parseInt(userQueryOpts.radiusInMilesInt);
    const paginationPageNumUpdated = parseInt(userQueryOpts.skipDocsNum);
    userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: paginationPageNumUpdated, userLocation: userlocationValsUpdated, radiusInMilesInt: valOfRadiusFieldUpdated });
    console.log('will query for matches...');
    const queryMatchesResults = yield getMatches(userQueryOpts, query.userId);
    const { status, data, msg } = queryMatchesResults;
    if (!data || !data.potentialMatches || (status !== 200)) {
        console.error("Something went wrong. Couldn't get matches from the database. Message from query result: ", msg);
        console.error('Error status code: ', status);
        return response.status(status).json({ msg: "Something went wrong. Couldnt't matches." });
    }
    const { potentialMatches: getMatchesResultPotentialMatches, hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, updatedSkipDocsNum } = data;
    let { errMsg, potentialMatches: filterUsersWithoutPromptsPotentialMatches, prompts } = yield filterUsersWithoutPrompts(getMatchesResultPotentialMatches);
    console.log("filterUsersWithoutPrompts function has been executed. Will check if there was an error.");
    if (errMsg) {
        console.error("An error has occurred in filtering out users without prompts. Error msg: ", errMsg);
        return response.status(500).json({ msg: `Error! Something went wrong. Couldn't get prompts for users. Error msg: ${errMsg}` });
    }
    let getUsersWithPromptsResult = { potentialMatches: filterUsersWithoutPromptsPotentialMatches, prompts };
    if (filterUsersWithoutPromptsPotentialMatches.length < 5) {
        console.log('At least one user does not have any prompts in the db. Will get users with prompts from the database.');
        // data.page.hasValidUsersToDisplayOnCurrentPg is true, then use the current page's skipDocsNum. Else, add 5 to it if it is false
        const updatedSkipDocNumInt = (typeof data.updatedSkipDocsNum === 'string') ? parseInt(data.updatedSkipDocsNum) : data.updatedSkipDocsNum;
        const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: data.canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) });
        getUsersWithPromptsResult = yield getUsersWithPrompts(_userQueryOpts, query.userId, filterUsersWithoutPromptsPotentialMatches);
    }
    let potentialMatchesToDisplayToUserOnClient = getUsersWithPromptsResult.potentialMatches;
    let responseBody = { potentialMatchesPagination: Object.assign(Object.assign({}, data), { potentialMatches: potentialMatchesToDisplayToUserOnClient }) };
    if ((potentialMatchesToDisplayToUserOnClient.length === 0)) {
        return response.status(status).json(responseBody);
    }
    console.log('Getting matches info for client...');
    const potentialMatchesForClientResult = yield getMatchesInfoForClient(potentialMatchesToDisplayToUserOnClient, getUsersWithPromptsResult.prompts);
    responseBody.potentialMatchesPagination.potentialMatches = potentialMatchesForClientResult.potentialMatches;
    console.log('Potential matches info has been retrieved. Will check if the user has valid pic urls.');
    if ((potentialMatchesForClientResult.potentialMatches.length < 5) && !hasReachedPaginationEnd) {
        console.log("At least one user does not have a valid pic url. Will get more users with prompts and valid pic urls.");
        const updatedSkipDocNumInt = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;
        const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) });
        const getMoreUsersAfterPicUrlFailureResult = yield getPromptsAndPicUrlsOfUsersAfterPicUrlRetrievalFailure(_userQueryOpts, query.userId, potentialMatchesForClientResult.usersWithValidUrlPics);
        if (!getMoreUsersAfterPicUrlFailureResult.matchesQueryPage) {
            console.error("Something went wrong. Couldn't get the matches query page object. Will send the available potential matches to the client.");
            return response.status(200).json(responseBody);
        }
        if (getMoreUsersAfterPicUrlFailureResult.errorMsg) {
            console.error("Failed to get more users with valid pic urls. Sending current matches that have valid pic aws urls. Error message: ", getMoreUsersAfterPicUrlFailureResult.errorMsg);
            responseBody = { potentialMatchesPagination: Object.assign(Object.assign({}, getMoreUsersAfterPicUrlFailureResult.matchesQueryPage), { potentialMatches: potentialMatchesForClientResult.potentialMatches }) };
            return response.status(200).json(responseBody);
        }
        if ((_a = getMoreUsersAfterPicUrlFailureResult.potentialMatches) === null || _a === void 0 ? void 0 : _a.length) {
            responseBody = { potentialMatchesPagination: Object.assign(Object.assign({}, getMoreUsersAfterPicUrlFailureResult.matchesQueryPage), { potentialMatches: getMoreUsersAfterPicUrlFailureResult.potentialMatches }) };
        }
        if (!((_b = getMoreUsersAfterPicUrlFailureResult.potentialMatches) === null || _b === void 0 ? void 0 : _b.length)) {
            responseBody = { potentialMatchesPagination: Object.assign(Object.assign({}, getMoreUsersAfterPicUrlFailureResult.matchesQueryPage), { potentialMatches: [] }) };
        }
    }
    console.timeEnd('getMatchesRoute');
    console.log("Potential matches has been retrieved. Will send them to the client.");
    return response.status(status).json(responseBody);
}));
