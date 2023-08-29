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
import axios from 'axios';
import { cache } from "../../utils/cache.js";
import { EXPIRATION_TIME_CACHED_MATCHES } from "../../globalVals.js";
function getValidMatches(userQueryOpts, currentUser, currentValidUserMatches, idsOfUsersNotToShow = []) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let validMatchesToSendToClient = currentValidUserMatches;
        let _userQueryOpts = Object.assign({}, userQueryOpts);
        let matchesPage = {};
        let _hasReachedPaginationEnd = false;
        try {
            let timeBeforeLoopMs = new Date().getTime();
            while (validMatchesToSendToClient.length < 5) {
                let loopTimeElapsed = new Date().getTime() - timeBeforeLoopMs;
                if (loopTimeElapsed > 10000) {
                    console.error('Time out has occurred.');
                    matchesPage = {
                        hasReachedPaginationEnd: _hasReachedPaginationEnd,
                        canStillQueryCurrentPageForUsers: false,
                        validMatches: validMatchesToSendToClient,
                        didTimeOutOccur: true,
                        updatedSkipDocsNum: _userQueryOpts.skipDocsNum,
                    };
                    break;
                }
                const queryOptsForPagination = createQueryOptsForPagination(_userQueryOpts, currentUser, idsOfUsersNotToShow);
                const queryMatchesResults = yield getMatches(queryOptsForPagination);
                const { data, status } = queryMatchesResults;
                const { hasReachedPaginationEnd, potentialMatches } = data;
                _hasReachedPaginationEnd = hasReachedPaginationEnd;
                if (status !== 200) {
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
                        didErrorOccur: true,
                    };
                    break;
                }
                let matchesToSendToClient = (potentialMatches === null || potentialMatches === void 0 ? void 0 : potentialMatches.length) ? yield filterInUsersWithValidMatchingPicUrl(potentialMatches) : [];
                console.log("matchesToSendToClient.length after filter: ", matchesToSendToClient.length);
                matchesToSendToClient = matchesToSendToClient.length ? yield filterInUsersWithPrompts(matchesToSendToClient) : [];
                let usersToAddNum = 0;
                const matchesToSendToClientCopy = matchesToSendToClient.length ? structuredClone(matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum)) : [];
                matchesToSendToClient = matchesToSendToClientCopy.length ? matchesToSendToClientCopy : [];
                if (matchesToSendToClient.length && (validMatchesToSendToClient.length !== 5)) {
                    usersToAddNum = 5 - validMatchesToSendToClient.length;
                    matchesToSendToClient = matchesToSendToClient.slice(0, usersToAddNum);
                    validMatchesToSendToClient.push(...matchesToSendToClient);
                }
                console.log("_userQueryOpts: ", _userQueryOpts.skipDocsNum);
                console.log('validMatchestoSendToClient: ', validMatchesToSendToClient);
                console.log("validMatchesToSendToClient.length: ", validMatchesToSendToClient.length);
                console.log('_hasReachedPaginationEnd: ', _hasReachedPaginationEnd);
                const _updatedSkipDocsNum = (typeof _userQueryOpts.skipDocsNum === 'string') ? parseInt(_userQueryOpts.skipDocsNum) : _userQueryOpts.skipDocsNum;
                if ((validMatchesToSendToClient.length < 5) && !_hasReachedPaginationEnd) {
                    _userQueryOpts = Object.assign(Object.assign({}, _userQueryOpts), { skipDocsNum: _updatedSkipDocsNum + 5 });
                }
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
                        const userIdsOfMatchesToCacheSliced = matchesToSendToClientCopy.slice(usersToAddNum, potentialMatches.length);
                        let userIdsOfMatchesToCache = (userIdsOfMatchesToCacheSliced === null || userIdsOfMatchesToCacheSliced === void 0 ? void 0 : userIdsOfMatchesToCacheSliced.length) ? userIdsOfMatchesToCacheSliced.map(({ _id }) => _id) : [];
                        matchesPage.canStillQueryCurrentPageForUsers = (usersToAddNum !== (potentialMatches.length - 1));
                        if (!matchesPage.canStillQueryCurrentPageForUsers) {
                            matchesPage.updatedSkipDocsNum = _updatedSkipDocsNum + 5;
                        }
                        const userIdsOfMatchesToShowForMatchesPgCache = cache.get("userIdsOfMatchesToShowForMatchesPg");
                        if ((_a = userIdsOfMatchesToShowForMatchesPgCache === null || userIdsOfMatchesToShowForMatchesPgCache === void 0 ? void 0 : userIdsOfMatchesToShowForMatchesPgCache[currentUser._id]) === null || _a === void 0 ? void 0 : _a.length) {
                            const cachedUserIdsForCurrentUser = userIdsOfMatchesToShowForMatchesPgCache[currentUser._id];
                            userIdsOfMatchesToCache = (userIdsOfMatchesToCache === null || userIdsOfMatchesToCache === void 0 ? void 0 : userIdsOfMatchesToCache.length) ? [...userIdsOfMatchesToCache, ...cachedUserIdsForCurrentUser] : cachedUserIdsForCurrentUser;
                        }
                        const result = cache.set("userIdsOfMatchesToShowForMatchesPg", { [currentUser._id]: userIdsOfMatchesToCache }, EXPIRATION_TIME_CACHED_MATCHES);
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
    // for testing:
    // let skipAndLimitObj = { skip: 0, limit: 150 };
    // the above is for testing: 
    let skipAndLimitObj = { skip: skipDocsNum, limit: 5 };
    const returnVal = { skipAndLimitObj, paginationQueryOpts, currentPageNum };
    return returnVal;
}
function getProjectionObj(projectedFields) {
    return projectedFields.reduce((projectedFieldObj, projectedFieldsArr) => {
        const [userKeyName, zeroOrOneNum] = projectedFieldsArr;
        projectedFieldObj[userKeyName] = zeroOrOneNum;
        return projectedFieldObj;
    }, {});
}
function queryForPotentialMatches(queryOptsForPagination) {
    return __awaiter(this, void 0, void 0, function* () {
        let { skipAndLimitObj, paginationQueryOpts, currentPageNum } = queryOptsForPagination;
        if (paginationQueryOpts === null || paginationQueryOpts === void 0 ? void 0 : paginationQueryOpts.location) {
            Users.createIndexes([{ location: '2dsphere' }]);
        }
        const projectionObj = getProjectionObj([
            ['createdAt', 0],
            ['updatedAt', 0],
            ['phoneNum', 0],
            ['email', 0],
            ['password', 0],
            ['hasPrompts', 0],
            ['__v', 0],
        ]);
        const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count();
        const potentialMatchesPromise = Users.find(paginationQueryOpts, projectionObj, skipAndLimitObj).sort({ ratingNum: 'desc' }).lean();
        let [totalUsersForQuery, potentialMatches] = yield Promise.all([totalUsersForQueryPromise, potentialMatchesPromise]);
        const hasReachedPaginationEnd = (5 * currentPageNum) >= totalUsersForQuery;
        if (totalUsersForQuery === 0) {
            return { potentialMatches: [], hasReachedPaginationEnd: true };
        }
        if (hasReachedPaginationEnd) {
            return { potentialMatches: potentialMatches, hasReachedPaginationEnd: true };
        }
        return { potentialMatches: potentialMatches, hasReachedPaginationEnd: (5 * currentPageNum) >= totalUsersForQuery, totalUsersForQuery: totalUsersForQuery };
    });
}
// REFACTOR NOTES FOR THIS FN:
// change add all of the ids of the users into a single array and pass it in as a parameter to this function
function getIdsOfUsersNotToShow(currentUserId, rejectedUsers, allRecipientsOfChats, idsOfUserMatchesReceivedOnClient) {
    const allRejectedUserIds = [
        ...new Set((rejectedUsers)
            .flatMap((rejectedUserInfo) => {
            return [rejectedUserInfo.rejectedUserId, rejectedUserInfo.rejectorUserId];
        })
            .filter(userId => currentUserId !== userId))
    ];
    if (idsOfUserMatchesReceivedOnClient === null || idsOfUserMatchesReceivedOnClient === void 0 ? void 0 : idsOfUserMatchesReceivedOnClient.length) {
        return [...allRejectedUserIds, ...allRecipientsOfChats, ...idsOfUserMatchesReceivedOnClient];
    }
    return [...allRejectedUserIds, ...allRecipientsOfChats];
}
function getMatches(queryOptsForPagination) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('queryOptsForPagination, getMatches fn: ', queryOptsForPagination);
            const potentialMatchesPaginationObj = yield queryForPotentialMatches(queryOptsForPagination);
            console.log("potentialMatchesPaginationObj.potentialMatches: ", potentialMatchesPaginationObj.potentialMatches);
            return {
                status: 200,
                data: potentialMatchesPaginationObj
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
export { getMatches, createQueryOptsForPagination, getIdsOfUsersNotToShow, getPromptsAndMatchingPicForClient, getLocationStrForUsers, getLocationStr, getValidMatches };
