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
import { createQueryOptsForPagination, getIdsOfUsersNotToShow, getLocationStrForUsers, getMatches, getPromptsAndMatchingPicForClient, getValidMatches } from '../../services/matching/matchesQueryServices.js';
import { getAllUserChats } from '../../services/firebaseServices/firebaseDbServices.js';
import { generateGetRejectedUsersQuery, getRejectedUsers } from '../../services/rejectingUsers/rejectedUsersService.js';
import { getUserById, getUsersByIds } from '../../services/globalMongoDbServices.js';
import { filterInUsersWithPrompts } from '../../services/promptsServices/getPromptsServices.js';
import { filterInUsersWithValidMatchingPicUrl } from '../../services/matching/helper-fns/aws.js';
import { cache } from '../../utils/cache.js';
import { GLOBAL_VALS, EXPIRATION_TIME_CACHED_MATCHES } from '../../globalVals.js';
export const getMatchesRoute = Router();
function validateFormOfObj(key, obj) {
    const receivedType = typeof obj[key];
    return { fieldName: key, receivedType: receivedType };
}
function getQueryOptionsValidationArr(queryOpts) {
    const { userLocation, desiredAgeRange, skipDocsNum, minAndMaxDistanceArr, isRadiusSetToAnywhere } = queryOpts !== null && queryOpts !== void 0 ? queryOpts : {};
    console.log('userLocation: ', userLocation);
    const [latitude, longitude] = Array.isArray(userLocation) ? userLocation : [];
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
function generateMatchesPg(matchesPaginationObj) {
    const { canStillQueryCurrentPageForUsers, hasReachedPaginationEnd, validMatches, updatedSkipDocsNum, didErrorOccur, didTimeOutOccur } = matchesPaginationObj !== null && matchesPaginationObj !== void 0 ? matchesPaginationObj : {};
    return {
        hasReachedPaginationEnd: !!hasReachedPaginationEnd,
        validMatches: validMatches,
        updatedSkipDocsNum: updatedSkipDocsNum,
        canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers,
        didErrorOccur: !!didErrorOccur,
        didTimeOutOccur: !!didTimeOutOccur
    };
}
// BUG: 
// WHAT IS HAPPENING: when the time out is completed, the updated skip nums value is not being updated. It is still zero when the time out has reached. 
// updated skip docs num is not being updated
// brain dump:
// for silver and bronze:
// for bronze: the user can only have 15 matches in a span 48 hour period
// for silver: the user can only have 25 matches in a span 48 hour period
function filterInUsersWithValidPromptsAndMatchingImg(potentialMatches) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let matchesToSendToClient = yield filterInUsersWithValidMatchingPicUrl(potentialMatches);
            matchesToSendToClient = (matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length) ? yield filterInUsersWithPrompts(matchesToSendToClient) : [];
            return (matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length) ? matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum) : [];
        }
        catch (error) {
            console.error("Something went wrong couldn't filter in valid users: ", error);
            return [];
        }
    });
}
getMatchesRoute.get(`/${GLOBAL_VALS.matchesRootPath}/get-matches`, (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
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
    let idsOfUsersNotToShow = getIdsOfUsersNotToShow(currentUserId, rejectedUsers, allChatUsers);
    if (!currentUser) {
        console.error('Could not find current user in the db.');
        return response.status(404).json({ msg: 'Could not find current user in the db.' });
    }
    // put the below into a function 
    const userIdsOfMatchesToShowForMatchesPg = cache.get("userIdsOfMatchesToShowForMatchesPg");
    console.log("userIdsOfMatchesToShowForMatchesPg?.[currentUserId]: ", userIdsOfMatchesToShowForMatchesPg === null || userIdsOfMatchesToShowForMatchesPg === void 0 ? void 0 : userIdsOfMatchesToShowForMatchesPg[currentUserId]);
    let savedUserIdsOfMatches = (_c = userIdsOfMatchesToShowForMatchesPg === null || userIdsOfMatchesToShowForMatchesPg === void 0 ? void 0 : userIdsOfMatchesToShowForMatchesPg[currentUserId]) !== null && _c !== void 0 ? _c : [];
    savedUserIdsOfMatches = (savedUserIdsOfMatches === null || savedUserIdsOfMatches === void 0 ? void 0 : savedUserIdsOfMatches.length) ? savedUserIdsOfMatches.filter(userId => !idsOfUsersNotToShow.includes(userId)) : [];
    let startingMatches = null;
    console.log("savedUserIdsOfMatches.length: ", savedUserIdsOfMatches.length);
    // the id of the user that was received from the last test run: 01H2S38E7NMK4RAGQPTCYJSE1S
    if (savedUserIdsOfMatches.length) {
        console.log('Getting users from db based on users saved in the cache.');
        let savedUsersInCache = yield getUsersByIds(savedUserIdsOfMatches);
        console.log("savedUsersInCache: ", savedUsersInCache);
        savedUsersInCache = (savedUsersInCache === null || savedUsersInCache === void 0 ? void 0 : savedUsersInCache.length) ? yield filterInUsersWithValidPromptsAndMatchingImg(savedUsersInCache) : [];
        console.log("savedUsersInCache after filter: ", savedUsersInCache);
        startingMatches = (savedUsersInCache === null || savedUsersInCache === void 0 ? void 0 : savedUsersInCache.length) ? savedUsersInCache : [];
        cache.set("userIdsOfMatchesToShowForMatchesPg", { [currentUserId]: [] });
    }
    // put the above into a function
    idsOfUsersNotToShow = (startingMatches === null || startingMatches === void 0 ? void 0 : startingMatches.length) ? [...startingMatches.map(({ _id }) => _id), ...idsOfUsersNotToShow] : idsOfUsersNotToShow;
    const queryOptsForPagination = createQueryOptsForPagination(userQueryOpts, currentUser, idsOfUsersNotToShow);
    const queryMatchesResults = yield getMatches(queryOptsForPagination);
    let { hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, potentialMatches } = queryMatchesResults.data;
    if ((potentialMatches === null || potentialMatches === void 0 ? void 0 : potentialMatches.length) && (startingMatches === null || startingMatches === void 0 ? void 0 : startingMatches.length)) {
        potentialMatches = [...startingMatches, ...potentialMatches];
    }
    console.log("potentialMatches: ", potentialMatches);
    console.log('potentialMatches.length: ', potentialMatches === null || potentialMatches === void 0 ? void 0 : potentialMatches.length);
    // FOR TESTING PURPOSES, BELOW:
    // let _potentialMatches = potentialMatches as UserBaseModelSchema[];
    // const usersOfPromptsToDelete = _potentialMatches?.filter(({ pics }) => {
    //     const matchingPic = pics.find(({ isMatching }) => isMatching);
    //     return (matchingPic?.picFileNameOnAws !== 'test-img-3.jpg');
    // })
    // const potentialMatchesWithTestImg3 = _potentialMatches?.filter(({ pics }) => {
    //     const matchingPic = pics.find(({ isMatching }) => isMatching);
    //     return (matchingPic?.picFileNameOnAws === 'test-img-3.jpg');
    // })
    // const userIdsOfPromptsToDelete = usersOfPromptsToDelete.map(({ _id, ratingNum }) => ({ _id, ratingNum }))
    // const userIds = usersOfPromptsToDelete.map(({ _id }) => _id);
    // const potentialMatchesWithTestImg3UserIds = potentialMatchesWithTestImg3.map(({ _id }) => _id)
    // const totalUsersQueried = userIdsOfPromptsToDelete.length + potentialMatchesWithTestImg3UserIds.length
    // const userIdsAndRatingNum = _potentialMatches.map(({ _id, ratingNum }) => ({ _id, ratingNum }))
    // console.log('userIdsAndRatingNum: ', userIdsAndRatingNum)
    // console.log('totalUsersQueried: ', totalUsersQueried)
    // console.log('userIdsOfPromptsToDelete: ', userIdsOfPromptsToDelete)
    // console.log('potentialMatchesWithTestImg3UserIds: ', potentialMatchesWithTestImg3UserIds)
    // response.status(200).json({ msg: "Users received!", userIds: userIds })
    // FOR TESTING PURPOSES, ABOVE:
    const _updateSkipDocsNum = (typeof (userQueryOpts === null || userQueryOpts === void 0 ? void 0 : userQueryOpts.skipDocsNum) === 'string') ? parseInt(userQueryOpts.skipDocsNum) : userQueryOpts.skipDocsNum;
    if (queryMatchesResults.status !== 200) {
        return response.status(queryMatchesResults.status).json({ msg: queryMatchesResults.msg });
    }
    if (potentialMatches === undefined) {
        console.log('Potential matches: ', potentialMatches);
        return response.status(500).json({ msg: "Failed to get potential matches." });
    }
    let matchesToSendToClient = yield filterInUsersWithValidMatchingPicUrl(potentialMatches);
    matchesToSendToClient = (matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length) ? yield filterInUsersWithPrompts(matchesToSendToClient) : [];
    matchesToSendToClient = (matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length) ? matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum) : [];
    const areCachedUsersValid = ((savedUserIdsOfMatches === null || savedUserIdsOfMatches === void 0 ? void 0 : savedUserIdsOfMatches.length) && (matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length)) ? matchesToSendToClient.some(({ _id }) => savedUserIdsOfMatches.includes(_id)) : false;
    if (areCachedUsersValid && (matchesToSendToClient.length > 5)) {
        console.log('Adding users who were saved in the cache first to the array that will be sent to the client.');
        let usersToSendToClientUpdated = matchesToSendToClient.filter(({ _id }) => savedUserIdsOfMatches.includes(_id));
        console.log('usersToSendToClientUpdated: ', usersToSendToClientUpdated);
        let usersNotSavedInCache = matchesToSendToClient.filter(({ _id }) => !savedUserIdsOfMatches.includes(_id));
        console.log('usersNotSavedInCache: ', usersNotSavedInCache);
        let userIdsToSaveIntoCache = [];
        if (usersNotSavedInCache.length > 0) {
            for (let numIteration = 0; usersNotSavedInCache.length < 5; numIteration++) {
                if (usersToSendToClientUpdated.length === 5) {
                    userIdsToSaveIntoCache = usersNotSavedInCache.slice(numIteration).map(({ _id }) => _id);
                    break;
                }
                usersToSendToClientUpdated.push(usersNotSavedInCache[numIteration]);
            }
        }
        matchesToSendToClient = usersToSendToClientUpdated;
        if ((matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length) > 5) {
            const matchesUserIdsToCache = matchesToSendToClient.slice(5).map(({ _id }) => _id);
            userIdsToSaveIntoCache = (userIdsToSaveIntoCache === null || userIdsToSaveIntoCache === void 0 ? void 0 : userIdsToSaveIntoCache.length) ? [...userIdsToSaveIntoCache, ...matchesUserIdsToCache] : matchesUserIdsToCache;
            matchesToSendToClient = matchesToSendToClient.slice(0, 5);
        }
        if (userIdsToSaveIntoCache === null || userIdsToSaveIntoCache === void 0 ? void 0 : userIdsToSaveIntoCache.length) {
            console.log('Saving users into the cache.');
            const userIdsOfMatchesToShowForMatchesPg = cache.get("userIdsOfMatchesToShowForMatchesPg");
            let matchesUserIdsForCurrentUsers = (_d = userIdsOfMatchesToShowForMatchesPg === null || userIdsOfMatchesToShowForMatchesPg === void 0 ? void 0 : userIdsOfMatchesToShowForMatchesPg[currentUserId]) !== null && _d !== void 0 ? _d : [];
            matchesUserIdsForCurrentUsers = [...matchesUserIdsForCurrentUsers, ...userIdsToSaveIntoCache];
            console.log("matchesUserIdsForCurrentUsers: ", matchesUserIdsForCurrentUsers);
            cache.set("userIdsOfMatchesToShowForMatchesPg", { [currentUserId]: matchesUserIdsForCurrentUsers }, EXPIRATION_TIME_CACHED_MATCHES);
        }
    }
    let paginationMatchesObj = {
        hasReachedPaginationEnd: hasReachedPaginationEnd,
        updatedSkipDocsNum: _updateSkipDocsNum,
        canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers,
    };
    if (!hasReachedPaginationEnd && ((matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length) < 5)) {
        const _skipDocsNum = !!canStillQueryCurrentPageForUsers ? _updateSkipDocsNum : _updateSkipDocsNum + 5;
        const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: _skipDocsNum });
        console.time("Getting matches again timing.");
        const getValidMatchesResult = yield getValidMatches(_userQueryOpts, currentUser, matchesToSendToClient, idsOfUsersNotToShow);
        console.timeEnd("Getting matches again timing.");
        const { didTimeOutOccur, didErrorOccur, updatedSkipDocsNum, validMatches, canStillQueryCurrentPageForUsers: canStillQueryCurrentPageForUsersValidMatches, hasReachedPaginationEnd } = (_e = getValidMatchesResult.page) !== null && _e !== void 0 ? _e : {};
        paginationMatchesObj.didTimeOutOccur = didTimeOutOccur !== null && didTimeOutOccur !== void 0 ? didTimeOutOccur : false;
        paginationMatchesObj.updatedSkipDocsNum = updatedSkipDocsNum;
        paginationMatchesObj.canStillQueryCurrentPageForUsers = !!canStillQueryCurrentPageForUsersValidMatches;
        paginationMatchesObj.hasReachedPaginationEnd = hasReachedPaginationEnd;
        if (didErrorOccur) {
            return response.status(500).json({ msg: 'An error has occurred in getting the matches.' });
        }
        matchesToSendToClient = validMatches !== null && validMatches !== void 0 ? validMatches : [];
    }
    if (!matchesToSendToClient.length) {
        console.log('No matches to send to client.');
        paginationMatchesObj.potentialMatches = [];
        return response.status(200).json({ paginationMatches: paginationMatchesObj });
    }
    const matchesToSendToClientUpdated = matchesToSendToClient.map((user) => {
        const _user = user;
        return Object.assign(Object.assign({}, _user), { firstName: _user.name.first });
    });
    const promptsAndMatchingPicForClientResult = yield getPromptsAndMatchingPicForClient(matchesToSendToClientUpdated);
    if (!promptsAndMatchingPicForClientResult.wasSuccessful) {
        console.error('Something went wrong. Couldn\'t get prompts and matching pic for client.');
        return response.status(500).json({ msg: promptsAndMatchingPicForClientResult.msg });
    }
    let potentialMatchesForClient = promptsAndMatchingPicForClientResult.data;
    potentialMatchesForClient = yield getLocationStrForUsers(potentialMatchesForClient);
    paginationMatchesObj.potentialMatches = potentialMatchesForClient;
    console.log('paginationMatchesObj: ', paginationMatchesObj);
    console.log("paginationMatchesObj.potentialMatches ids: ", paginationMatchesObj.potentialMatches.map(({ _id }) => _id));
    response.status(200).json({ paginationMatches: paginationMatchesObj });
    console.timeEnd('getMatchesRoute, timing.');
}));
