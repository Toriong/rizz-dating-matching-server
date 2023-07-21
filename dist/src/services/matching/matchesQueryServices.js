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
import { getMatchesWithPrompts } from "../promptsServices/getPromptsServices.js";
import { getMatchingPicUrlForUsers } from "./helper-fns/aws.js";
import moment from "moment";
import dotenv from 'dotenv';
import axios from 'axios';
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
    // brain dump:
    // have the limit be 30, in order to perform faster queries
    const skipAndLimitObj = { skip: skipDocsNum, limit: 5 };
    const returnVal = { skipAndLimitObj, paginationQueryOpts, currentPageNum };
    return returnVal;
}
function queryForPotentialMatches(queryOptsForPagination, skipDocsNum) {
    return __awaiter(this, void 0, void 0, function* () {
        let { skipAndLimitObj, paginationQueryOpts, currentPageNum } = queryOptsForPagination;
        let updatedSkipDocsNum = skipDocsNum;
        if (paginationQueryOpts === null || paginationQueryOpts === void 0 ? void 0 : paginationQueryOpts.location) {
            Users.createIndexes([{ location: '2dsphere' }]);
        }
        // THE BELOW IS FOR TESTING:
        // skip: 50, limit: 5, the users of the sixth page
        // skip: 55, limit: 5, the users of the seventh page
        // skipAndLimitObj = { skip: 100, limit: 5  };
        // THE ABOVE IS FOR TESTING:
        // BRAIN DUMP:
        // get the first 50 users, get all of their ids, and check for the following:
        // if they have valid prompts
        // and matching pic url
        const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count();
        const potentialMatchesPromise = Users.find(paginationQueryOpts, null, skipAndLimitObj).sort({ ratingNum: 'desc' }).lean();
        let [totalUsersForQuery, potentialMatches] = yield Promise.all([totalUsersForQueryPromise, potentialMatchesPromise]);
        const hasReachedPaginationEnd = (5 * currentPageNum) >= totalUsersForQuery;
        if (totalUsersForQuery === 0) {
            return { potentialMatches: [], updatedSkipDocsNum: 0, canStillQueryCurrentPageForUsers: false, hasReachedPaginationEnd: true };
        }
        if (hasReachedPaginationEnd) {
            return { potentialMatches: potentialMatches, updatedSkipDocsNum: updatedSkipDocsNum, canStillQueryCurrentPageForUsers: false, hasReachedPaginationEnd: true };
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
function getReverseGeoCode(userLocation) {
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
            const userLocationStrResult = yield getReverseGeoCode(userLocation.coordinates);
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
export { getMatches, createQueryOptsForPagination, getIdsOfUsersNotToShow, getPromptsAndMatchingPicForClient, getLocationStrForUsers };
