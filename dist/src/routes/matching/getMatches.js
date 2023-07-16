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
import { createQueryOptsForPagination, getIdsOfUsersNotToShow, getMatches, getPromptsAndMatchingPicForClient } from '../../services/matching/matchesQueryServices.js';
import { getAllUserChats } from '../../services/firebaseServices/firebaseDbServices.js';
import { getRejectedUsers } from '../../services/rejectingUsers/rejectedUsersService.js';
import { getUserById } from '../../services/globalMongoDbServices.js';
import { filterInUsersWithPrompts } from '../../services/promptsServices/getPromptsServices.js';
import { filterInUsersWithValidMatchingPicUrl } from '../../services/matching/helper-fns/aws.js';
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
function getValidMatches(userQueryOpts, currentUserId, validUserMatches) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const usersToRetrieveNum = 5 - validUserMatches.length;
        const allUserChatsResult = yield getAllUserChats(currentUserId);
        const rejectedUsersQuery = {
            $or: [
                { rejectedUserId: { $in: [currentUserId] } },
                { rejectorUserId: { $in: [currentUserId] } }
            ]
        };
        const rejectedUsersThatCurrentUserIsInResult = yield getRejectedUsers(rejectedUsersQuery);
        const rejectedUsers = ((_a = rejectedUsersThatCurrentUserIsInResult.data) === null || _a === void 0 ? void 0 : _a.length) ? rejectedUsersThatCurrentUserIsInResult.data : [];
        const allChatUsers = ((_b = allUserChatsResult.data) === null || _b === void 0 ? void 0 : _b.length) ? allUserChatsResult.data : [];
        const idsOfUsersNotToShow = yield getIdsOfUsersNotToShow(currentUserId, rejectedUsers, allChatUsers);
        const currentUser = yield getUserById(currentUserId);
        if (!currentUser) {
            console.error('Could not find current user in the db.');
            return { hasReachedPaginationEnd: true, validMatches: validUserMatches, updatedSkipDocsNum: userQueryOpts.skipDocsNum, canStillQueryCurrentPageForUsers: false, didErrorOccur: true };
        }
        const queryOptsForPagination = createQueryOptsForPagination(userQueryOpts, currentUser, idsOfUsersNotToShow);
        const queryMatchesResults = yield getMatches(queryOptsForPagination, userQueryOpts.skipDocsNum);
        const { hasReachedPaginationEnd, potentialMatches, updatedSkipDocsNum, canStillQueryCurrentPageForUsers } = queryMatchesResults.data;
        console.log('getMatches, potentialMatches array: ', potentialMatches);
        if (queryMatchesResults.status !== 200) {
            return { hasReachedPaginationEnd: true, validMatches: validUserMatches, updatedSkipDocsNum: userQueryOpts.skipDocsNum, canStillQueryCurrentPageForUsers: false, didErrorOccur: true };
        }
        if (potentialMatches === undefined) {
            console.log('Potential matches: ', potentialMatches);
            return { hasReachedPaginationEnd: true, validMatches: validUserMatches, updatedSkipDocsNum: userQueryOpts.skipDocsNum, canStillQueryCurrentPageForUsers: false, didErrorOccur: true };
        }
        let matchesToSendToClient = yield filterInUsersWithValidMatchingPicUrl(potentialMatches);
        matchesToSendToClient = (matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length) ? yield filterInUsersWithPrompts(matchesToSendToClient) : [];
        matchesToSendToClient = (matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length) ? matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum).slice(0, usersToRetrieveNum) : [];
        matchesToSendToClient = [...matchesToSendToClient, ...validUserMatches].sort((userA, userB) => userB.ratingNum - userA.ratingNum);
        const _updatedSkipDocsNum = typeof updatedSkipDocsNum === 'string' ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;
        let getValidMatchesResult = { hasReachedPaginationEnd, validMatches: potentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum, canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers };
        // BRAIN DUMP:
        // get the first 50 users
        // for the first 50 users, do the following:
        // get the amount of users that have imgage 3 as their matching pic, those users will be unshowable
        // the rest of the users will have their prompts deleted from the db
        // the target users of the page will be the three users of the sixth page. For the sixth page, get the users
        // that has the 3rd image as their matching pic
        // get users from the seventh page, and add them to page that will be present to the user on the client side.
        // check what is being received for the getMatches function  
        // GOAL #1: the target users of the page is retrieved and sent to the client.
        // GOAL #2: get the users of the sixth and seventh page 
        // GOAL #3: get the users of the first 5 pages. These users will have their prompts delete from the db or have their matching pic url deleted from aws if their 
        // matching pic is test-img-3.
        if (!hasReachedPaginationEnd && (matchesToSendToClient.length < 5)) {
            console.log('At least one user does not have a valid matching pic url or prompts. Getting new users.');
            const _skipDocsNum = (typeof userQueryOpts.skipDocsNum === 'string') ? parseInt(userQueryOpts.skipDocsNum) : userQueryOpts.skipDocsNum;
            const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: _skipDocsNum + 5 });
            getValidMatchesResult = (yield getValidMatches(_userQueryOpts, currentUserId, matchesToSendToClient));
        }
        return getValidMatchesResult;
    });
}
getMatchesRoute.get(`/${GLOBAL_VALS.matchesRootPath}/get-matches`, (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.time('getMatchesRoute');
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
    // change the values in userLocation into a number, assuming they are string since they are stored in the params of the request.
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
    const allUserChatsResult = yield getAllUserChats(currentUserId);
    const rejectedUsersQuery = {
        $or: [
            { rejectedUserId: { $in: [currentUserId] } },
            { rejectorUserId: { $in: [currentUserId] } }
        ]
    };
    const rejectedUsersThatCurrentUserIsInResult = yield getRejectedUsers(rejectedUsersQuery);
    const rejectedUsers = ((_a = rejectedUsersThatCurrentUserIsInResult.data) === null || _a === void 0 ? void 0 : _a.length) ? rejectedUsersThatCurrentUserIsInResult.data : [];
    const allChatUsers = ((_b = allUserChatsResult.data) === null || _b === void 0 ? void 0 : _b.length) ? allUserChatsResult.data : [];
    const idsOfUsersNotToShow = yield getIdsOfUsersNotToShow(currentUserId, rejectedUsers, allChatUsers);
    const currentUser = yield getUserById(currentUserId);
    if (!currentUser) {
        console.error('Could not find current user in the db.');
        return response.status(404).json({ msg: 'Could not find current user in the db.' });
    }
    const queryOptsForPagination = createQueryOptsForPagination(userQueryOpts, currentUser, idsOfUsersNotToShow);
    const queryMatchesResults = yield getMatches(queryOptsForPagination, paginationPageNumUpdated);
    const { hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, potentialMatches, updatedSkipDocsNum } = queryMatchesResults.data;
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
    console.log("hasReachedPaginationEnd: ", hasReachedPaginationEnd);
    console.log("matchesToSendToClient: ", matchesToSendToClient);
    if (!hasReachedPaginationEnd && (matchesToSendToClient.length < 5)) {
        console.log("Some users either don't have prompts or a matching pic. Getting new users.");
        const getValidMatchesResult = yield getValidMatches(userQueryOpts, currentUserId, matchesToSendToClient);
        console.log("getValidMatchesResult: ", getValidMatchesResult);
        matchesToSendToClient = getValidMatchesResult.validMatches;
    }
    const matchesToSendToClientUpdated = matchesToSendToClient.map((user) => {
        const _user = user;
        return Object.assign(Object.assign({}, _user), { firstName: _user.name.first });
    });
    console.log("matchesToSendToClientUpdated: ", matchesToSendToClientUpdated);
    const promptsAndMatchingPicForClientResult = yield getPromptsAndMatchingPicForClient(matchesToSendToClientUpdated);
    console.log("promptsAndMatchingPicForClientResult: ", promptsAndMatchingPicForClientResult);
    if (!promptsAndMatchingPicForClientResult.wasSuccessful) {
        return response.status(500).json({ msg: promptsAndMatchingPicForClientResult.msg });
    }
    paginationMatchesObj.validMatches = promptsAndMatchingPicForClientResult.data;
    return response.status(200).json({ paginationMatches: paginationMatchesObj });
}));
