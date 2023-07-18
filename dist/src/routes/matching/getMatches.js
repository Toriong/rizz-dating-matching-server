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
import { createQueryOptsForPagination, getIdsOfUsersNotToShow, getMatches, getPromptsAndMatchingPicForClient } from '../../services/matching/matchesQueryServices.js';
import { getAllUserChats } from '../../services/firebaseServices/firebaseDbServices.js';
import { generateGetRejectedUsersQuery, getRejectedUsers } from '../../services/rejectingUsers/rejectedUsersService.js';
import { getUserById } from '../../services/globalMongoDbServices.js';
import { filterInUsersWithPrompts } from '../../services/promptsServices/getPromptsServices.js';
import { filterInUsersWithValidMatchingPicUrl } from '../../services/matching/helper-fns/aws.js';
import GLOBAL_VALS from '../../globalVals.js';
export const getMatchesRoute = Router();
function validateFormOfObj(key, obj) {
    const receivedType = typeof obj[key];
    return { fieldName: key, receivedType: receivedType };
}
function getQueryOptionsValidationArr(queryOpts) {
    const { userLocation, desiredAgeRange, skipDocsNum, minAndMaxDistanceArr, isRadiusSetToAnywhere } = queryOpts !== null && queryOpts !== void 0 ? queryOpts : {};
    const [latitude, longitude] = userLocation !== null && userLocation !== void 0 ? userLocation : [];
    let areValsInMinAndMaxQueryDistanceArrValid = false;
    let minAndMaxDistanceQueryArrValidationObj = null;
    let areValsInDesiredAgeRangeArrValid = false;
    let areDesiredAgeRangeValsValidObj = null;
    let isLongAndLatValueTypeValid = false;
    let areLongAndLatValid = null;
    if (!isRadiusSetToAnywhere) {
        areValsInMinAndMaxQueryDistanceArrValid = (Array.isArray(desiredAgeRange) && (desiredAgeRange.length === 2)) && desiredAgeRange.every(date => !Number.isNaN(Date.parse(date)));
        minAndMaxDistanceQueryArrValidationObj = {
            receivedType: typeof minAndMaxDistanceArr,
            correctVal: 'number',
            fieldName: 'radiusInMilesInt',
            val: minAndMaxDistanceArr,
            isCorrectValType: areValsInMinAndMaxQueryDistanceArrValid
        };
        areValsInDesiredAgeRangeArrValid = (Array.isArray(desiredAgeRange) && (desiredAgeRange.length === 2)) && desiredAgeRange.every(date => !Number.isNaN(Date.parse(date)));
        areDesiredAgeRangeValsValidObj = {
            receivedType: typeof desiredAgeRange,
            recievedTypeOfValsInArr: desiredAgeRange.map(ageDate => typeof ageDate),
            correctVal: 'object',
            fieldName: 'desiredAgeRange',
            isCorrectValType: areValsInDesiredAgeRangeArrValid, val: desiredAgeRange
        };
        isLongAndLatValueTypeValid = (!!longitude && !!latitude) && ((typeof longitude === 'string') && (typeof latitude === 'string')) && ((typeof parseFloat(longitude) === 'number') && (typeof parseFloat(latitude) === 'number'));
        areLongAndLatValid = {
            receivedType: typeof userLocation,
            recievedTypeOfValsInArr: Object.keys(userLocation).map(key => validateFormOfObj(key, userLocation)),
            correctVal: 'number',
            fieldName: 'userLocation',
            isCorrectValType: isLongAndLatValueTypeValid,
            val: userLocation,
        };
    }
    const paginationPageNumValidationObj = { receivedType: typeof skipDocsNum, correctVal: 'number', fieldName: 'skipDocsNum', isCorrectValType: typeof parseInt(skipDocsNum) === 'number', val: skipDocsNum };
    let defaultValidationKeyValsArr = [paginationPageNumValidationObj];
    if (!isRadiusSetToAnywhere && minAndMaxDistanceQueryArrValidationObj && areDesiredAgeRangeValsValidObj && areLongAndLatValid) {
        return [...defaultValidationKeyValsArr, minAndMaxDistanceQueryArrValidationObj, areDesiredAgeRangeValsValidObj, areLongAndLatValid];
    }
    const isRadiusSetToAnywhereValidtionObj = { receivedType: typeof isRadiusSetToAnywhere, correctVal: 'boolean', fieldName: 'isRadiusSetToAnywhere', isCorrectValType: typeof Boolean(isRadiusSetToAnywhere) === 'boolean', val: isRadiusSetToAnywhere };
    return [...defaultValidationKeyValsArr, isRadiusSetToAnywhereValidtionObj];
}
function getIdAndPics(user) {
    const pic = user.pics.find(({ isMatching }) => isMatching);
    return { pic, _id: user._id };
}
// move all outputs of functions that are n(1) as parameters for the getValidMatches function
function getValidMatches(userQueryOpts, currentUser, currentValidUserMatches, idsOfUsersNotToShow = []) {
    return __awaiter(this, void 0, void 0, function* () {
        let validMatchesToSendToClient = [];
        let _userQueryOpts = Object.assign({}, userQueryOpts);
        let matchesPage = {};
        const usersToRetrieveNum = 5 - currentValidUserMatches.length;
        // if the below while loop take longer than 15 seconds, break it tell the client that the server is taking longer than usually to get the matches, the client can do the following: 
        // wait for the matches
        // start over their search for matches
        try {
            while (validMatchesToSendToClient.length < 5) {
                const queryOptsForPagination = createQueryOptsForPagination(_userQueryOpts, currentUser, idsOfUsersNotToShow);
                const queryMatchesResults = yield getMatches(queryOptsForPagination, _userQueryOpts.skipDocsNum);
                const { hasReachedPaginationEnd, potentialMatches, updatedSkipDocsNum, canStillQueryCurrentPageForUsers } = queryMatchesResults.data;
                if (queryMatchesResults.status !== 200) {
                    matchesPage = {
                        hasReachedPaginationEnd: true,
                        validMatches: currentValidUserMatches,
                        updatedSkipDocsNum: _userQueryOpts.skipDocsNum,
                        canStillQueryCurrentPageForUsers: false,
                        didErrorOccur: true
                    };
                    break;
                }
                if (potentialMatches === undefined) {
                    matchesPage = {
                        hasReachedPaginationEnd: true,
                        validMatches: currentValidUserMatches,
                        updatedSkipDocsNum: _userQueryOpts.skipDocsNum,
                        canStillQueryCurrentPageForUsers: false,
                        didErrorOccur: true
                    };
                    break;
                }
                // have both async functions be executed at the same time
                // compare the results of both async functions
                // get the intersection of both results using the Set data structure
                // combine the results into an array, and using the intersection in the previous step, get the values that are in the intersection set 
                let matchesToSendToClient = yield filterInUsersWithValidMatchingPicUrl(potentialMatches);
                matchesToSendToClient = matchesToSendToClient.length ? yield filterInUsersWithPrompts(matchesToSendToClient) : [];
                matchesToSendToClient = matchesToSendToClient.length ? matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum).slice(0, usersToRetrieveNum) : [];
                matchesToSendToClient = matchesToSendToClient.length ? [...matchesToSendToClient, ...currentValidUserMatches].sort((userA, userB) => userB.ratingNum - userA.ratingNum) : [];
                if (matchesToSendToClient.length) {
                    validMatchesToSendToClient.push(...matchesToSendToClient);
                }
                let _updatedSkipDocsNum = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;
                if ((validMatchesToSendToClient.length < 5) && !hasReachedPaginationEnd) {
                    _updatedSkipDocsNum = _updatedSkipDocsNum + 5;
                    _userQueryOpts = Object.assign(Object.assign({}, _userQueryOpts), { skipDocsNum: _updatedSkipDocsNum });
                }
                if (hasReachedPaginationEnd || (validMatchesToSendToClient.length >= 5)) {
                    matchesPage = {
                        hasReachedPaginationEnd,
                        validMatches: validMatchesToSendToClient,
                        updatedSkipDocsNum: _updatedSkipDocsNum,
                        canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers
                    };
                    if (hasReachedPaginationEnd) {
                        break;
                    }
                }
            }
            return { page: matchesPage };
        }
        catch (error) {
            console.error('Failed to get valid matches. An error has occurred: ', error);
            return { didErrorOccur: true };
        }
    });
}
getMatchesRoute.get(`/${GLOBAL_VALS.matchesRootPath}/get-matches`, (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    console.time('getMatchesRoute, timing.');
    let query = request.query;
    if (!query || !(query === null || query === void 0 ? void 0 : query.query) || !query.userId) {
        return response.status(400).json({ msg: 'Missing query parameters.' });
    }
    let userQueryOpts = query.query;
    const currentUserId = query.userId;
    const queryOptsValidArr = getQueryOptionsValidationArr(userQueryOpts);
    const areQueryOptsValid = queryOptsValidArr.every(queryValidationObj => queryValidationObj.isCorrectValType);
    if (!areQueryOptsValid) {
        const invalidQueryOpts = queryOptsValidArr.filter(({ isCorrectValType }) => !isCorrectValType);
        console.table(invalidQueryOpts);
        console.error('An errror has occurred. Invalid query parameters.');
        return response.status(400).json({ msg: 'Invalid query parameters.' });
    }
    console.log("Will get the user's matches and send them to the client.");
    const { userLocation, skipDocsNum, minAndMaxDistanceArr } = userQueryOpts;
    const paginationPageNumUpdated = parseInt(skipDocsNum);
    if ((minAndMaxDistanceArr === null || minAndMaxDistanceArr === void 0 ? void 0 : minAndMaxDistanceArr.length) && (userLocation === null || userLocation === void 0 ? void 0 : userLocation.length)) {
        const _userLocation = [userLocation[0], userLocation[1]].map(val => parseFloat(val));
        const _minAndMaxDistanceArrUpdated = minAndMaxDistanceArr.map(val => parseInt(val));
        userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: paginationPageNumUpdated, userLocation: _userLocation, minAndMaxDistanceArr: _minAndMaxDistanceArrUpdated });
    }
    if ((userQueryOpts === null || userQueryOpts === void 0 ? void 0 : userQueryOpts.isRadiusSetToAnywhere) && (Boolean(userQueryOpts.isRadiusSetToAnywhere) && (userQueryOpts.isRadiusSetToAnywhere === 'true'))) {
        userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: paginationPageNumUpdated, isRadiusSetToAnywhere: true });
    }
    const rejectedUsersQuery = generateGetRejectedUsersQuery([currentUserId], true);
    const [allUserChatsResult, rejectedUsersThatCurrentUserIsInResult, currentUser] = yield Promise.all([getAllUserChats(currentUserId), getRejectedUsers(rejectedUsersQuery), getUserById(currentUserId)]);
    const rejectedUsers = ((_a = rejectedUsersThatCurrentUserIsInResult.data) === null || _a === void 0 ? void 0 : _a.length) ? rejectedUsersThatCurrentUserIsInResult.data : [];
    const allChatUsers = ((_b = allUserChatsResult.data) === null || _b === void 0 ? void 0 : _b.length) ? allUserChatsResult.data : [];
    const idsOfUsersNotToShow = getIdsOfUsersNotToShow(currentUserId, rejectedUsers, allChatUsers);
    if (!currentUser) {
        console.error('Could not find current user in the db.');
        return response.status(404).json({ msg: 'Could not find current user in the db.' });
    }
    const queryOptsForPagination = createQueryOptsForPagination(userQueryOpts, currentUser, idsOfUsersNotToShow);
    const queryMatchesResults = yield getMatches(queryOptsForPagination, paginationPageNumUpdated);
    const { hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, potentialMatches, updatedSkipDocsNum } = queryMatchesResults.data;
    console.log("potentialMatches.length: ", potentialMatches === null || potentialMatches === void 0 ? void 0 : potentialMatches.length);
    const _updateSkipDocsNum = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;
    if (queryMatchesResults.status !== 200) {
        return response.status(queryMatchesResults.status).json({ msg: queryMatchesResults.msg });
    }
    if (potentialMatches === undefined) {
        console.log('Potential matches: ', potentialMatches);
        return response.status(500).json({ msg: "Failed to get potential matches." });
    }
    let matchesToSendToClient = yield filterInUsersWithValidMatchingPicUrl(potentialMatches);
    matchesToSendToClient = (matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length) ? yield filterInUsersWithPrompts(matchesToSendToClient) : [];
    let paginationMatchesObj = {
        hasReachedPaginationEnd: hasReachedPaginationEnd,
        updatedSkipDocsNum: _updateSkipDocsNum,
        canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers,
    };
    if (!hasReachedPaginationEnd && (matchesToSendToClient.length < 5)) {
        console.time("Getting matches again timing.");
        const getValidMatchesResult = yield getValidMatches(userQueryOpts, currentUser, matchesToSendToClient, idsOfUsersNotToShow);
        console.timeEnd("Getting matches again timing.");
        if (getValidMatchesResult.didTimeOut) {
            // cache the results of the query
            return response.status(408).json({ msg: 'The server is taking longer than usual to get the matches.' });
        }
        if (getValidMatchesResult.didErrorOccur) {
            return response.status(500).json({ msg: 'An error has occurred in getting the matches.' });
        }
        matchesToSendToClient = (_c = getValidMatchesResult.page.validMatches) !== null && _c !== void 0 ? _c : [];
    }
    if (!matchesToSendToClient.length) {
        paginationMatchesObj.potentialMatches = [];
        return response.status(200).json({ paginationMatches: paginationMatchesObj });
    }
    const matchesToSendToClientUpdated = matchesToSendToClient.map((user) => {
        const _user = user;
        return Object.assign(Object.assign({}, _user), { firstName: _user.name.first });
    });
    const promptsAndMatchingPicForClientResult = yield getPromptsAndMatchingPicForClient(matchesToSendToClientUpdated);
    if (!promptsAndMatchingPicForClientResult.wasSuccessful) {
        return response.status(500).json({ msg: promptsAndMatchingPicForClientResult.msg });
    }
    paginationMatchesObj.potentialMatches = promptsAndMatchingPicForClientResult.data;
    response.status(200).json({ paginationMatches: paginationMatchesObj });
    console.timeEnd('getMatchesRoute, timing.');
}));
