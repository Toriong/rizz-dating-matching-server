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
import { getRejectedUsers } from '../../services/rejectingUsers/rejectedUsersService.js';
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
function getValidMatches(userQueryOpts, currentUserId, currentValidUserMatches) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const usersToRetrieveNum = 5 - currentValidUserMatches.length;
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
            return { hasReachedPaginationEnd: true, validMatches: currentValidUserMatches, updatedSkipDocsNum: userQueryOpts.skipDocsNum, canStillQueryCurrentPageForUsers: false, didErrorOccur: true };
        }
        const queryOptsForPagination = createQueryOptsForPagination(userQueryOpts, currentUser, idsOfUsersNotToShow);
        const queryMatchesResults = yield getMatches(queryOptsForPagination, userQueryOpts.skipDocsNum);
        const { hasReachedPaginationEnd, potentialMatches, updatedSkipDocsNum, canStillQueryCurrentPageForUsers } = queryMatchesResults.data;
        if (queryMatchesResults.status !== 200) {
            return { hasReachedPaginationEnd: true, validMatches: currentValidUserMatches, updatedSkipDocsNum: userQueryOpts.skipDocsNum, canStillQueryCurrentPageForUsers: false, didErrorOccur: true };
        }
        if (potentialMatches === undefined) {
            console.log('Potential matches: ', potentialMatches);
            return { hasReachedPaginationEnd: true, validMatches: currentValidUserMatches, updatedSkipDocsNum: userQueryOpts.skipDocsNum, canStillQueryCurrentPageForUsers: false, didErrorOccur: true };
        }
        //  WHAT I KNOW:
        // -able to delete all users with test-img-3
        // -for the page that is received from the backend, users with test image 3 is still being received
        // THE BUG:
        // for the page that is being received from the backend, the two users has their matching pic as testing image 3, even though that image doesn't exist
        // WHAT I WANT: 
        // filter out all users that don't have a valid mathcing pic url, i.e. when it doesn't exist in aws
        // ACTIONABLE STEPS:
        // get the name of the matching pic for each user
        // if the image is testing-image-3, then it should throw an error
        // BUG OCCURRING HERE? not deleting users with test-img-3
        let matchesToSendToClient = yield filterInUsersWithValidMatchingPicUrl(potentialMatches);
        const userPics = matchesToSendToClient.map(user => {
            const pic = user.pics.find(({ isMatching }) => isMatching);
            return { pic, _id: user._id };
        });
        console.log("userPics after filterInUsersWithValidMatchingPicUrl was executed: ", userPics);
        // BUG OCCURING ABOVE? not deleting users with test-img-3
        matchesToSendToClient = (matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length) ? yield filterInUsersWithPrompts(matchesToSendToClient) : [];
        console.log("matchesToSendToClient after filterInUsersWithPrompts execution: ", matchesToSendToClient.length);
        matchesToSendToClient = (matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length) ? matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum).slice(0, usersToRetrieveNum) : [];
        const userIdAndPic = currentValidUserMatches.map(getIdAndPics);
        console.log("userIdAndPic: ", userIdAndPic);
        matchesToSendToClient = [...matchesToSendToClient, ...currentValidUserMatches].sort((userA, userB) => userB.ratingNum - userA.ratingNum);
        const _updatedSkipDocsNum = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;
        let getValidMatchesResult = { hasReachedPaginationEnd, validMatches: potentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum, canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers };
        let usersUpdated = matchesToSendToClient.map(user => {
            const pic = user.pics.find(({ isMatching }) => isMatching);
            return { pic, _id: user._id };
        });
        console.log("usersUpdated, before checks: ", usersUpdated);
        console.log("hasReachedPaginationEnd: ", hasReachedPaginationEnd);
        if (!hasReachedPaginationEnd && (matchesToSendToClient.length < 5)) {
            console.log('At least one user does not have a valid matching pic url or prompts. Getting new users.');
            const _skipDocsNum = (typeof userQueryOpts.skipDocsNum === 'string') ? parseInt(userQueryOpts.skipDocsNum) : userQueryOpts.skipDocsNum;
            const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: _skipDocsNum + 5 });
            console.log("matchesToSendToClient.length: ", matchesToSendToClient.length);
            let usersUpdated = matchesToSendToClient.map(user => {
                const pic = user.pics.find(({ isMatching }) => isMatching);
                return { pic, _id: user._id };
            });
            console.log("usersUpdated, recursion is being executed: ", usersUpdated);
            const getValidMatchesResultUpdated = yield getValidMatches(_userQueryOpts, currentUserId, matchesToSendToClient);
            console.log("getValidMatchesResult, after recursion function call: ", getValidMatchesResultUpdated.validMatches.map(user => {
                const pic = user.pics.find(({ isMatching }) => isMatching);
                return { pic, _id: user._id };
            }));
            getValidMatchesResult.validMatches = getValidMatchesResultUpdated.validMatches;
        }
        let _usersUpdated = matchesToSendToClient.map(user => {
            const pics = user.pics.map(({ isMatching, picFileNameOnAws }) => (JSON.stringify({ isMatching, picFileNameOnAws })));
            return { pics: pics, _id: user._id };
        });
        console.log("After checks, matches updated: ", _usersUpdated);
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
    console.log("potentialMatches.length: ", potentialMatches === null || potentialMatches === void 0 ? void 0 : potentialMatches.length);
    const _updateSkipDocsNum = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;
    if (queryMatchesResults.status !== 200) {
        return response.status(queryMatchesResults.status).json({ msg: queryMatchesResults.msg });
    }
    if (potentialMatches === undefined) {
        console.log('Potential matches: ', potentialMatches);
        return response.status(500).json({ msg: "Failed to get potential matches." });
    }
    // console.log("potentialMatches.length, after getMatches function was executed: ", potentialMatches.length)
    // const usersWithTestImg3 = potentialMatches.filter(({ pics }) => {
    //     const matchingPic = pics.find(({ isMatching }) => isMatching);
    //     if (matchingPic?.picFileNameOnAws === "test-img-3.jpg") {
    //         return true;
    //     }
    //     return false;
    // })
    // const idsOfUsersWithTestImg3 = usersWithTestImg3.map(({ _id }) => _id);
    // console.log("idsOfUsersWithTestImg3, after getMatches function was executed:  ", idsOfUsersWithTestImg3)
    // const nonTestImg3Users = potentialMatches.filter(({ _id }) => !idsOfUsersWithTestImg3.includes(_id));
    // const idsOfNonTestImg3Users = nonTestImg3Users.map(({ _id, ratingNum }) => ({ _id, ratingNum })).sort((userA, userB) => userB.ratingNum - userA.ratingNum);
    // console.log("idsOfNonTestImg3Users, after getMatches function was executed: ", idsOfNonTestImg3Users)
    // const totalUnshowableUsersNum = idsOfNonTestImg3Users.length + idsOfUsersWithTestImg3.length;
    // console.log("totalUnshowableUsersNum, after getMatches function was executed: ", totalUnshowableUsersNum)
    let matchesToSendToClient = yield filterInUsersWithValidMatchingPicUrl(potentialMatches);
    console.log("matchesToSendToClient after filterInUsersWithValidMatchingPicUrl execution: ", matchesToSendToClient.length);
    matchesToSendToClient = (matchesToSendToClient === null || matchesToSendToClient === void 0 ? void 0 : matchesToSendToClient.length) ? yield filterInUsersWithPrompts(matchesToSendToClient) : [];
    let paginationMatchesObj = {
        hasReachedPaginationEnd: hasReachedPaginationEnd,
        updatedSkipDocsNum: _updateSkipDocsNum,
        canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers,
    };
    console.log("hasReachedPaginationEnd: ", hasReachedPaginationEnd);
    console.log("matchesToSendToClient.length, before getValidMatches function call: ", matchesToSendToClient.length);
    if (!hasReachedPaginationEnd && (matchesToSendToClient.length < 5)) {
        console.log("Some users either don't have prompts or a matching pic. Getting new users.");
        // this function is causing a infinite recursive call
        console.time("Getting matches again timing.");
        const getValidMatchesResult = yield getValidMatches(userQueryOpts, currentUserId, matchesToSendToClient);
        console.timeEnd("Getting matches again timing.");
        // GOAL: to check to see image pic url is valid. Should not get users with test image 3.
        const userMatchingPics = getValidMatchesResult.validMatches.map(user => {
            const pic = user.pics.find(({ isMatching }) => isMatching);
            return {
                _id: user._id,
                pic: pic
            };
        });
        console.log("userMatchingPics: ", userMatchingPics);
        matchesToSendToClient = getValidMatchesResult.validMatches;
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
    console.log("paginationMatchesObj.potentialMatches: ", paginationMatchesObj.potentialMatches);
    return response.status(200).json({ paginationMatches: paginationMatchesObj });
}));
