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
import moment from "moment";
import { getMatchesWithPrompts } from "../promptsServices/getPromptsServices.js";
import { getMatchingPicUrlForUsers } from "./helper-fns/aws.js";
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
        const { skipAndLimitObj, paginationQueryOpts, currentPageNum } = queryOptsForPagination;
        let updatedSkipDocsNum = skipDocsNum;
        Users.createIndexes([{ location: '2dsphere' }]);
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
    return __awaiter(this, void 0, void 0, function* () {
        const allRejectedUserIds = [
            ...new Set((rejectedUsers)
                .flatMap((rejectedUserInfo) => {
                return [rejectedUserInfo.rejectedUserId, rejectedUserInfo.rejectorUserId];
            })
                .filter(userId => currentUserId !== userId))
        ];
        return [...allRejectedUserIds, ...allRecipientsOfChats];
    });
}
// this function will only get the users based on queryOpts object
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
function getPromptsAndMatchingPicForClient(matches) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const matchesWithPromptsResult = yield getMatchesWithPrompts(matches);
            console.log("matchesWithPromptsResult: ", matchesWithPromptsResult);
            if (!matchesWithPromptsResult.wasSuccessful) {
                throw new Error('Failed to get prompts for matches.');
            }
            const matchesWithPicsResult = yield getMatchingPicUrlForUsers(matchesWithPromptsResult.data);
            console.log("matchesWithPicsResult: ", matchesWithPicsResult);
            // get the location text for each user
            if (!matchesWithPicsResult.wasSuccessful) {
                throw new Error('An error has occurred in getting matching pic for users.');
            }
            console.log("matchesWithPicsResult.data getPromptsAndMatchingPicForClient: ", matchesWithPicsResult.data);
            return { wasSuccessful: true, data: matchesWithPicsResult.data };
        }
        catch (error) {
            console.error('Getting prompts and matching pic for client error: ', error);
            return { wasSuccessful: false, msg: 'Getting prompts and matching pic for client error: ' + (error === null || error === void 0 ? void 0 : error.message) };
        }
    });
}
export { getMatches, createQueryOptsForPagination, getIdsOfUsersNotToShow, getPromptsAndMatchingPicForClient };
// FOR CHECKING WHAT USERS ARE ATTAINED BASED ON A SPECIFIC QUERY
// const { userLocation, minAndMaxDistanceArr, desiredAgeRange, skipDocsNum, isRadiusSetToAnywhere } = userQueryOpts;
// // CASE: 
// // the user querying with a radius set
// // GOAL:
// // dynamically add the location field to the paginationQueryOpts object only if the following is true: 
// // if userLocation is defined
// // if minAndMaxDistanceArr is defined
// // CASE:
// // the user querying with the radius set to anywhere
// // GOAL:
// // don't add the location field to the queryOpts object
// let updatedSkipDocsNum = skipDocsNum;
// console.log('skipDocsNum: ', skipDocsNum)
// // print minAndMaxDistanceArr
// console.log('minAndMaxDistanceArr: ', minAndMaxDistanceArr)
// const currentPageNum = (skipDocsNum as number) / 5;
// console.log('currentPageNum: ', currentPageNum)
// const METERS_IN_A_MILE = 1609.34;
// const [minAge, maxAge] = desiredAgeRange;
// const paginationQueryOpts: PaginationQueryingOpts = {
//     sex: (currentUser.sex === 'Male') ? 'Female' : 'Male',
//     hasPrompts: true,
//     sexAttraction: currentUser.sexAttraction,
//     birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
// }
// if (userLocation && minAndMaxDistanceArr && !isRadiusSetToAnywhere) {
//     const [latitude, longitude] = userLocation as [number, number];
//     const [minDistance, maxDistance] = minAndMaxDistanceArr as [number, number];
//     paginationQueryOpts.location = {
//         $near: {
//             $geometry: { type: "Point", coordinates: [longitude, latitude] },
//             $maxDistance: (maxDistance) * METERS_IN_A_MILE,
//             $minDistance: (minDistance) * METERS_IN_A_MILE
//         }
//     }
// }
// console.log("isRadiusSetToAnywhere: ", isRadiusSetToAnywhere)
// if ((isRadiusSetToAnywhere === 'true') && Boolean(isRadiusSetToAnywhere)) {
//     paginationQueryOpts._id = { $nin: allUnshowableUserIds }
// }
// const pageOpts = { skip: 50, limit: 5 };
// (Users as any).createIndexes([{ location: '2dsphere' }])
// const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count()
// const potentialMatchesPromise = Users.find(paginationQueryOpts, null, pageOpts).sort({ ratingNum: 'desc' }).lean()
// let [totalUsersForQuery, pageQueryUsers]: [number, UserBaseModelSchema[]] = await Promise.all([totalUsersForQueryPromise, potentialMatchesPromise])
// return { status: 200, data: { potentialMatches: pageQueryUsers, updatedSkipDocsNum: 5, canStillQueryCurrentPageForUsers: true, hasReachedPaginationEnd: false } }
// THE ABOVE IS FOR CHECKING WHAT USERS ARE ATTAINED BASED ON A SPECIFIC QUERY
