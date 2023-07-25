var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { User as Users } from "../../models/User.js";
import { filterInUsersWithPrompts, getMatchesWithPrompts } from "../promptsServices/getPromptsServices.js";
import { filterInUsersWithValidMatchingPicUrl, getMatchingPicUrlForUsers } from "./helper-fns/aws.js";
import moment from "moment";
import dotenv from 'dotenv';
import axios from 'axios';
import cache from "../../utils/cache.js";
function getValidMatches(userQueryOpts, currentUser, currentValidUserMatches, idsOfUsersNotToShow = []) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let validMatchesToSendToClient = currentValidUserMatches;
        let _userQueryOpts = Object.assign({}, userQueryOpts);
        console.log("_userQueryOpts: ", _userQueryOpts);
        let matchesPage = {};
        let _hasReachedPaginationEnd = false;
        try {
            let timeBeforeLoopMs = new Date().getTime();
            while (validMatchesToSendToClient.length < 5) {
                let loopTimeElapsed = new Date().getTime() - timeBeforeLoopMs;
                if (loopTimeElapsed > 15000) {
                    matchesPage = {
                        hasReachedPaginationEnd: _hasReachedPaginationEnd,
                        canStillQueryCurrentPageForUsers: false,
                        updatedSkipDocsNum: _userQueryOpts === null || _userQueryOpts === void 0 ? void 0 : _userQueryOpts.skipDocsNum,
                        validMatches: validMatchesToSendToClient,
                        didTimeOutOccur: true
                    };
                    break;
                }
                const queryOptsForPagination = createQueryOptsForPagination(_userQueryOpts, currentUser, idsOfUsersNotToShow);
                const queryMatchesResults = yield getMatches(queryOptsForPagination);
                const { hasReachedPaginationEnd, potentialMatches } = queryMatchesResults.data;
                _hasReachedPaginationEnd = hasReachedPaginationEnd;
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
                // GOAL: don't get six users in the total of users to be returned from this function
                // let currentValidMatchesIds = currentValidUserMatches?.length ? currentValidUserMatches.map(({ _id }) => _id) : [];
                // let matchesToSendToClient = (potentialMatches?.length && currentValidMatchesIds.length) ? potentialMatches.filter(({ _id }) => !currentValidMatchesIds.includes(_id)) : potentialMatches;
                let matchesToSendToClient = (potentialMatches === null || potentialMatches === void 0 ? void 0 : potentialMatches.length) ? yield filterInUsersWithValidMatchingPicUrl(potentialMatches) : [];
                console.log("matchesToSendToClient.length after filter: ", matchesToSendToClient.length);
                matchesToSendToClient = matchesToSendToClient.length ? yield filterInUsersWithPrompts(matchesToSendToClient) : [];
                let usersToAddNum = 0;
                const matchesToSendToClientCopy = matchesToSendToClient.length ? structuredClone(matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum)) : [];
                matchesToSendToClient = matchesToSendToClient.length ? matchesToSendToClientCopy : [];
                // 5
                // 2
                // 10
                // 5
                if (matchesToSendToClient.length && (validMatchesToSendToClient.length !== 5)) {
                    usersToAddNum = 5 - validMatchesToSendToClient.length;
                    matchesToSendToClient = matchesToSendToClient.slice(0, usersToAddNum);
                    validMatchesToSendToClient.push(...matchesToSendToClient);
                }
                console.log("_userQueryOpts: ", _userQueryOpts.skipDocsNum);
                console.log('validMatchestoSendToClient: ', validMatchesToSendToClient);
                console.log("validMatchesToSendToClient.length: ", validMatchesToSendToClient.length);
                const _updatedSkipDocsNum = (typeof _userQueryOpts.skipDocsNum === 'string') ? parseInt(_userQueryOpts.skipDocsNum) : _userQueryOpts.skipDocsNum;
                if ((validMatchesToSendToClient.length < 5) && !_hasReachedPaginationEnd) {
                    _userQueryOpts = Object.assign(Object.assign({}, _userQueryOpts), { skipDocsNum: _updatedSkipDocsNum + 5 });
                }
                // getting 15 skip docs num on the client side, NEEDS TO BE 10
                if (_hasReachedPaginationEnd || ((validMatchesToSendToClient === null || validMatchesToSendToClient === void 0 ? void 0 : validMatchesToSendToClient.length) >= 5)) {
                    let validMatchesToSendToClientUpdated = ((validMatchesToSendToClient === null || validMatchesToSendToClient === void 0 ? void 0 : validMatchesToSendToClient.length) > 5) ? validMatchesToSendToClient.slice(0, 5) : validMatchesToSendToClient;
                    matchesPage = {
                        hasReachedPaginationEnd: _hasReachedPaginationEnd,
                        validMatches: validMatchesToSendToClientUpdated,
                        updatedSkipDocsNum: _updatedSkipDocsNum
                    };
                    // if the usersToAddNum does not equal to 5, then the user can still query the current page for more users
                    // or if the usersToAddNum does not equal the length of potentialMatches array minus one, then the current user can still query the current page for more users
                    if (!_hasReachedPaginationEnd) {
                        console.log("usersToAddNum: ", usersToAddNum);
                        console.log("potentialMatches.length: ", potentialMatches.length);
                        const userIdsOfMatchesToShowForMatchesPg = matchesToSendToClientCopy.slice(usersToAddNum, potentialMatches.length).map(({ _id }) => _id);
                        matchesPage.canStillQueryCurrentPageForUsers = (usersToAddNum !== (potentialMatches.length - 1));
                        if (!matchesPage.canStillQueryCurrentPageForUsers) {
                            matchesPage.updatedSkipDocsNum = _updatedSkipDocsNum + 5;
                        }
                        let currentCachedMatchesUserIds = userIdsOfMatchesToShowForMatchesPg;
                        const userIdsOfMatchesToShowForMatchesPgCache = cache.get("userIdsOfMatchesToShowForMatchesPg");
                        if ((_a = userIdsOfMatchesToShowForMatchesPgCache === null || userIdsOfMatchesToShowForMatchesPgCache === void 0 ? void 0 : userIdsOfMatchesToShowForMatchesPgCache[currentUser._id]) === null || _a === void 0 ? void 0 : _a.length) {
                            const cachedUserIdsForCurrentUser = userIdsOfMatchesToShowForMatchesPgCache[currentUser._id];
                            currentCachedMatchesUserIds = [...currentCachedMatchesUserIds, ...cachedUserIdsForCurrentUser];
                        }
                        const result = cache.set("userIdsOfMatchesToShowForMatchesPg", { [currentUser._id]: currentCachedMatchesUserIds }, 864000);
                        console.log('were queried users stored in cache: ', result);
                        const _matchesToShowForNextQuery = cache.get("userIdsOfMatchesToShowForMatchesPg");
                        console.log("_matchesToShowForNextQuery: ", _matchesToShowForNextQuery);
                    }
                    if (_hasReachedPaginationEnd) {
                        break;
                    }
                }
            }
            console.log("Finished getting matches to display to the user on the clientside: ", matchesPage);
            console.log("validMatchesToSendToClient: ", validMatchesToSendToClient.length);
            return { page: matchesPage };
        }
        catch (error) {
            console.error('Failed to get valid matches. An error has occurred: ', error);
            return { didErrorOccur: true };
        }
    });
}
function createQueryOptsForPagination(userQueryOpts, currentUser, allUnshowableUserIds) {
    const { userLocation, minAndMaxDistanceArr, desiredAgeRange, skipDocsNum, isRadiusSetToAnywhere } = userQueryOpts;
    const currentPageNum = skipDocsNum / 5;
    const METERS_IN_A_MILE = 1609.34;
    const [minAge, maxAge] = desiredAgeRange;
    const paginationQueryOpts = {
        sex: (currentUser.sex === 'Male') ? 'Female' : 'Male',
        hasPrompts: true,
        sexAttraction: currentUser.sexAttraction,
        birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
    };
    if (allUnshowableUserIds === null || allUnshowableUserIds === void 0 ? void 0 : allUnshowableUserIds.length) {
        paginationQueryOpts._id = { $nin: allUnshowableUserIds };
    }
    if (userLocation && minAndMaxDistanceArr && !isRadiusSetToAnywhere) {
        const [latitude, longitude] = userLocation;
        const [minDistance, maxDistance] = minAndMaxDistanceArr;
        paginationQueryOpts.location = {
            $near: {
                $geometry: { type: "Point", coordinates: [longitude, latitude] },
                $maxDistance: (maxDistance) * METERS_IN_A_MILE,
                $minDistance: (minDistance !== null && minDistance !== void 0 ? minDistance : 0) * METERS_IN_A_MILE
            }
        };
    }
    const skipAndLimitObj = { skip: skipDocsNum, limit: 5 };
    const returnVal = { skipAndLimitObj, paginationQueryOpts, currentPageNum };
    return returnVal;
}
function queryForPotentialMatches(queryOptsForPagination) {
    return __awaiter(this, void 0, void 0, function* () {
        let { skipAndLimitObj, paginationQueryOpts, currentPageNum } = queryOptsForPagination;
        if (paginationQueryOpts === null || paginationQueryOpts === void 0 ? void 0 : paginationQueryOpts.location) {
            Users.createIndexes([{ location: '2dsphere' }]);
        }
        const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count();
        const potentialMatchesPromise = Users.find(paginationQueryOpts, null, skipAndLimitObj).sort({ ratingNum: 'desc' }).lean();
        let [totalUsersForQuery, potentialMatches] = yield Promise.all([totalUsersForQueryPromise, potentialMatchesPromise]);
        const hasReachedPaginationEnd = (5 * currentPageNum) >= totalUsersForQuery;
        if (totalUsersForQuery === 0) {
            return { potentialMatches: [], hasReachedPaginationEnd: true };
        }
        if (hasReachedPaginationEnd) {
            return { potentialMatches: potentialMatches, hasReachedPaginationEnd: true };
        }
        return { potentialMatches: potentialMatches, hasReachedPaginationEnd: (5 * currentPageNum) >= totalUsersForQuery };
    });
}
function getIdsOfUsersNotToShow(currentUserId, rejectedUsers, allRecipientsOfChats) {
    const allRejectedUserIds = [
        ...new Set((rejectedUsers)
            .flatMap((rejectedUserInfo) => {
            return [rejectedUserInfo.rejectedUserId, rejectedUserInfo.rejectorUserId];
        })
            .filter(userId => currentUserId !== userId))
    ];
    return [...allRejectedUserIds, ...allRecipientsOfChats];
}
// CASE: don't need to get all of the users from the database for a specific query.
// brain dump:
// still get the users from the database in order to perform validations on the user's info, checking for correct matching pic url or correct prompts
function getMatches(queryOptsForPagination) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const potentialMatchesPaginationObj = yield queryForPotentialMatches(queryOptsForPagination);
            let _potentialMatches = potentialMatchesPaginationObj.potentialMatches;
            return {
                status: 200,
                data: Object.assign(Object.assign({}, potentialMatchesPaginationObj), { potentialMatches: _potentialMatches })
            };
        }
        catch (error) {
            console.error('An error has occurred in getting matches: ', error);
            const errMsg = `An error has occurred in getting matches for user: ${error}`;
            return { status: 500, msg: errMsg };
        }
    });
}
function getCountryName(countryCode) {
    let regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(countryCode);
}
function getLocationStr(userLocation) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            dotenv.config();
            const [longitude, latitude] = userLocation;
            const reverseGeoCodeUrl = `http://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=5&appid=${process.env.REVERSE_GEO_LOCATION_API_KEY}`;
            const response = yield axios.get(reverseGeoCodeUrl);
            const { status, data } = response;
            if (status !== 200) {
                throw new Error("Failed to get reverse geocode.");
            }
            ;
            console.log('Recevied reverse geo code data: ', data === null || data === void 0 ? void 0 : data[0]);
            const { name: city, state, country } = data[0];
            const countryName = getCountryName(country);
            if (!countryName) {
                throw new Error("Failed to get country name.");
            }
            const userLocationStr = state ? `${city}, ${state}, ${countryName}` : `${city}, ${countryName}`;
            return { wasSuccessful: true, data: userLocationStr };
        }
        catch (error) {
            console.error("Failed to get the reverse geocode of the user's location. Error message: ", error);
            return { wasSuccessful: false };
        }
    });
}
function getLocationStrForUsers(users) {
    return __awaiter(this, void 0, void 0, function* () {
        let usersUpdated = [];
        for (let numIteration = 0; numIteration < users.length; numIteration++) {
            let userMap = new Map(Object.entries(users[numIteration]));
            let userLocation = userMap.get('location');
            const userLocationStrResult = yield getLocationStr(userLocation.coordinates);
            if (userLocationStrResult.wasSuccessful) {
                userMap.set('locationStr', userLocationStrResult.data);
                userMap.delete('location');
            }
            else {
                userMap.set('locationErrorMsg', "Unable to get user's location.");
            }
            userMap.delete('pics');
            userMap.delete('name');
            usersUpdated.push(Object.fromEntries(userMap));
        }
        return usersUpdated;
    });
}
function getPromptsAndMatchingPicForClient(matches) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const matchesWithPromptsResult = yield getMatchesWithPrompts(matches);
            if (!matchesWithPromptsResult.wasSuccessful) {
                throw new Error('Failed to get prompts for matches.');
            }
            const matchesWithPicsResult = yield getMatchingPicUrlForUsers(matchesWithPromptsResult.data);
            if (!matchesWithPicsResult.wasSuccessful) {
                throw new Error('An error has occurred in getting matching pic for users.');
            }
            return { wasSuccessful: true, data: matchesWithPicsResult.data };
        }
        catch (error) {
            console.error('Getting prompts and matching pic for client error: ', error);
            return { wasSuccessful: false, msg: 'Getting prompts and matching pic for client error: ' + (error === null || error === void 0 ? void 0 : error.message) };
        }
    });
}
export { getMatches, createQueryOptsForPagination, getIdsOfUsersNotToShow, getPromptsAndMatchingPicForClient, getLocationStrForUsers, getValidMatches };
