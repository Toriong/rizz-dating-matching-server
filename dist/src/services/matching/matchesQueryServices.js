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
function getValidMatches(userQueryOpts, currentUser, currentValidUserMatches, idsOfUsersNotToShow = []) {
    return __awaiter(this, void 0, void 0, function* () {
        let validMatchesToSendToClient = [];
        let _userQueryOpts = Object.assign({}, userQueryOpts);
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
                const queryMatchesResults = yield getMatches(queryOptsForPagination, _userQueryOpts.skipDocsNum);
                const { hasReachedPaginationEnd, potentialMatches, updatedSkipDocsNum } = queryMatchesResults.data;
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
                let matchesToSendToClient = yield filterInUsersWithValidMatchingPicUrl(potentialMatches);
                matchesToSendToClient = matchesToSendToClient.length ? yield filterInUsersWithPrompts(matchesToSendToClient) : [];
                const endingSliceIndex = 5 - validMatchesToSendToClient.length;
                // after the slice, if the inverse of the slice is 0, then the current page can still be queried for users
                matchesToSendToClient = matchesToSendToClient.length ? matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum).slice(0, endingSliceIndex) : [];
                matchesToSendToClient = matchesToSendToClient.length ? [...matchesToSendToClient, ...currentValidUserMatches].sort((userA, userB) => userB.ratingNum - userA.ratingNum) : [];
                if (matchesToSendToClient.length) {
                    validMatchesToSendToClient.push(...matchesToSendToClient);
                }
                let _updatedSkipDocsNum = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;
                if ((validMatchesToSendToClient.length < 5) && !_hasReachedPaginationEnd) {
                    _updatedSkipDocsNum = _updatedSkipDocsNum + 5;
                    _userQueryOpts = Object.assign(Object.assign({}, _userQueryOpts), { skipDocsNum: _updatedSkipDocsNum });
                }
                if (_hasReachedPaginationEnd || (validMatchesToSendToClient.length >= 5)) {
                    let validMatchesToSendToClientUpdated = validMatchesToSendToClient.length > 5 ? validMatchesToSendToClient.slice(0, 5) : validMatchesToSendToClient;
                    matchesPage = {
                        hasReachedPaginationEnd: _hasReachedPaginationEnd,
                        validMatches: validMatchesToSendToClientUpdated,
                        updatedSkipDocsNum: _updatedSkipDocsNum,
                    };
                    // if the endingSliceIndex does not equal to 5, then the user can still query the current page for more users
                    // or if the endingSliceIndex does not equal the length of potentialMatches array minus one, then the current user can still query the current page for more users
                    if (!_hasReachedPaginationEnd) {
                        console.log("endingSliceIndex: ", endingSliceIndex);
                        console.log("potentialMatches.length: ", potentialMatches.length);
                        matchesPage['canStillQueryCurrentPageForUsers'] = (endingSliceIndex !== (potentialMatches.length - 1));
                        console.log("matchesPage['canStillQueryCurrentPageForUsers']: ", matchesPage['canStillQueryCurrentPageForUsers']);
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
function queryForPotentialMatches(queryOptsForPagination, skipDocsNum) {
    return __awaiter(this, void 0, void 0, function* () {
        let { skipAndLimitObj, paginationQueryOpts, currentPageNum } = queryOptsForPagination;
        let updatedSkipDocsNum = skipDocsNum + 5;
        if (paginationQueryOpts === null || paginationQueryOpts === void 0 ? void 0 : paginationQueryOpts.location) {
            Users.createIndexes([{ location: '2dsphere' }]);
        }
        const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count();
        const potentialMatchesPromise = Users.find(paginationQueryOpts, null, skipAndLimitObj).sort({ ratingNum: 'desc' }).lean();
        let [totalUsersForQuery, potentialMatches] = yield Promise.all([totalUsersForQueryPromise, potentialMatchesPromise]);
        const hasReachedPaginationEnd = (5 * currentPageNum) >= totalUsersForQuery;
        if (totalUsersForQuery === 0) {
            return { potentialMatches: [], updatedSkipDocsNum: 0, hasReachedPaginationEnd: true };
        }
        if (hasReachedPaginationEnd) {
            return { potentialMatches: potentialMatches, updatedSkipDocsNum, hasReachedPaginationEnd: true };
        }
        return { potentialMatches: potentialMatches, updatedSkipDocsNum, hasReachedPaginationEnd: (5 * currentPageNum) >= totalUsersForQuery };
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
// get the users of the sixth page
function getMatches(queryOptsForPagination, skipDocsNum) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const potentialMatchesPaginationObj = yield queryForPotentialMatches(queryOptsForPagination, skipDocsNum);
            return { status: 200, data: Object.assign({}, potentialMatchesPaginationObj) };
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
