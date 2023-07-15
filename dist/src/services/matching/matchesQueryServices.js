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
import { getUserById } from "../globalMongoDbServices.js";
import { getRejectedUsers } from "../rejectingUsers/rejectedUsersService.js";
import { getAllUserChats } from "../firebaseServices/firebaseDbServices.js";
function createQueryOptsForPagination(userQueryOpts, currentUser, allUnshowableUserIds = null) {
    const { userLocation, minAndMaxDistanceArr, desiredAgeRange, skipDocsNum, isRadiusSetToAnywhere } = userQueryOpts;
    console.log("userQueryOpts: ", userQueryOpts);
    console.log('skipDocsNum: ', skipDocsNum);
    const currentPageNum = skipDocsNum / 5;
    console.log('currentPageNum: ', currentPageNum);
    const METERS_IN_A_MILE = 1609.34;
    const [minAge, maxAge] = desiredAgeRange;
    const paginationQueryOpts = {
        sex: (currentUser.sex === 'Male') ? 'Female' : 'Male',
        hasPrompts: true,
        sexAttraction: currentUser.sexAttraction,
        birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
    };
    console.log('adding long, lat, distance query if sent from client...');
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
    if (isRadiusSetToAnywhere && (allUnshowableUserIds === null || allUnshowableUserIds === void 0 ? void 0 : allUnshowableUserIds.length)) {
        paginationQueryOpts._id = { $nin: allUnshowableUserIds };
    }
    const skipAndLimitObj = { skip: skipDocsNum, limit: 5 };
    const returnVal = { skipAndLimitObj, paginationQueryOpts, currentPageNum };
    console.log("returnVal: ", returnVal);
    console.log("paginationQueryOpts: ", paginationQueryOpts);
    return returnVal;
}
function queryForPotentialMatches(userQueryOpts, currentUser, allUnshowableUserIds, currentPotentialMatches = []) {
    return __awaiter(this, void 0, void 0, function* () {
        const { skipAndLimitObj, paginationQueryOpts, currentPageNum } = createQueryOptsForPagination(userQueryOpts, currentUser, allUnshowableUserIds);
        let updatedSkipDocsNum = userQueryOpts.skipDocsNum;
        console.log('currentPotentialMatches: ', currentPotentialMatches);
        console.log('allUnshowableUserIds: ', allUnshowableUserIds);
        Users.createIndexes([{ location: '2dsphere' }]);
        const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count();
        const potentialMatchesPromise = Users.find(paginationQueryOpts, null, skipAndLimitObj).sort({ ratingNum: 'desc' }).lean();
        let [totalUsersForQuery, pageQueryUsers] = yield Promise.all([totalUsersForQueryPromise, potentialMatchesPromise]);
        // GOAL: for the pageQueryUsers array, filter out all of the users that are in the currentPotentialMatches array
        // filter out any of the users in the pageQueryUsers array if they appear in the currentPotentialMatches array 
        const currentPotentialMatchesIds = currentPotentialMatches.map(({ _id }) => _id);
        console.log('currentPotentialMatchesIds: ', currentPotentialMatchesIds);
        console.log('currentPotentialMactchesIds: ', currentPotentialMatches.length);
        console.log('pageQueryUsers filtered: ', pageQueryUsers.filter(({ _id }) => !currentPotentialMatchesIds.includes(_id)));
        const hasReachedPaginationEnd = (5 * currentPageNum) >= totalUsersForQuery;
        if (totalUsersForQuery === 0) {
            return { potentialMatches: [], updatedSkipDocsNum: 0, canStillQueryCurrentPageForUsers: false, hasReachedPaginationEnd: true };
        }
        pageQueryUsers = pageQueryUsers.filter(({ _id }) => !allUnshowableUserIds.includes(_id));
        let potentialMatches = currentPotentialMatches;
        if (!pageQueryUsers.length && !hasReachedPaginationEnd) {
            console.log('no users were found for the current query.');
            const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: ((userQueryOpts.skipDocsNum / 5) + 1) * 5 });
            const results = yield queryForPotentialMatches(_userQueryOpts, currentUser, allUnshowableUserIds, potentialMatches);
            const { potentialMatches: updatedPotentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum } = results;
            potentialMatches = (updatedPotentialMatches === null || updatedPotentialMatches === void 0 ? void 0 : updatedPotentialMatches.length) ? updatedPotentialMatches : [];
            updatedSkipDocsNum = _updatedSkipDocsNum;
        }
        const sumBetweenPotentialMatchesAndPgQueryUsers = pageQueryUsers.length + potentialMatches.length;
        if ((sumBetweenPotentialMatchesAndPgQueryUsers < 5) && (sumBetweenPotentialMatchesAndPgQueryUsers > 0)) {
            console.log('Not enough user to display to the user on the client side, querying for more users...');
            // print out the ids of potentialMatches and pageQueryUsers
            console.log('potentialMatches ids: ', potentialMatches.map(({ _id }) => _id));
            console.log('pageQueryUsers: ', pageQueryUsers.map(({ _id }) => _id));
            // before the below step, delete any of the users in the pageQueryUsers array if they appear in the currentPotentialMatches array
            potentialMatches = [...potentialMatches, ...pageQueryUsers];
            // put the below into a function
            const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: ((userQueryOpts.skipDocsNum / 5) + 1) * 5 });
            const queryForPotentialMatchesResultsObj = yield queryForPotentialMatches(_userQueryOpts, currentUser, allUnshowableUserIds, potentialMatches);
            const { potentialMatches: updatedPotentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum } = queryForPotentialMatchesResultsObj;
            console.log("updatedPotentialMatches: ", updatedPotentialMatches);
            potentialMatches = (updatedPotentialMatches === null || updatedPotentialMatches === void 0 ? void 0 : updatedPotentialMatches.length) ? updatedPotentialMatches : [];
            updatedSkipDocsNum = _updatedSkipDocsNum;
            // put the above into a function
        }
        let endingSliceNum = 5;
        if (sumBetweenPotentialMatchesAndPgQueryUsers > 0) {
            console.log('Getting users to add to the existing potential matches array.');
            endingSliceNum = 5 - potentialMatches.length;
            console.log("endingSliceNum: ", endingSliceNum);
            console.log('pageQueryUsers: ', pageQueryUsers);
            console.log("potentialMatches: ", potentialMatches);
            const usersToAddToMatches = pageQueryUsers.sort((userA, userB) => userB.ratingNum - userA.ratingNum).slice(0, endingSliceNum);
            potentialMatches = [...potentialMatches, ...usersToAddToMatches].sort((userA, userB) => userB.ratingNum - userA.ratingNum);
        }
        console.log('Returning potential matches page info...');
        // WHERE IS THE DUPLCATION OCCURING? 
        // check the third conditional scope, check if the duplication is occuring there
        return { potentialMatches: potentialMatches, updatedSkipDocsNum, canStillQueryCurrentPageForUsers: endingSliceNum < 5, hasReachedPaginationEnd: (5 * currentPageNum) >= totalUsersForQuery };
    });
}
function getIdsOfUsersNotToShow(currentUserId) {
    return __awaiter(this, void 0, void 0, function* () {
        const rejectedUsersQuery = {
            $or: [
                { rejectedUserId: { $in: [currentUserId] } },
                { rejectorUserId: { $in: [currentUserId] } }
            ]
        };
        const rejectedUsersThatCurrentUserIsInResult = yield getRejectedUsers(rejectedUsersQuery);
        const allUserChatsResult = yield getAllUserChats(currentUserId);
        let allRecipientsOfChats = (Array.isArray(allUserChatsResult.data) && allUserChatsResult.data.length) ? allUserChatsResult.data : [];
        console.log('allRecipientsOfChats: ', allRecipientsOfChats);
        if (!allUserChatsResult.wasSuccessful) {
            console.error("Failed to get the current user from the firebase database.");
            throw new Error("Failed to get the current user from the firebase database.");
        }
        if ((rejectedUsersThatCurrentUserIsInResult.status !== 200) || !rejectedUsersThatCurrentUserIsInResult.data.length) {
            console.error('Failed to get the rejected users docs for the current user.');
            console.log('The current user either has not been rejected or has not rejected any users.');
        }
        const allRejectedUserIds = [
            ...new Set(rejectedUsersThatCurrentUserIsInResult.data
                .flatMap((rejectedUserInfo) => {
                return [rejectedUserInfo.rejectedUserId, rejectedUserInfo.rejectorUserId];
            })
                .filter(userId => currentUserId !== userId))
        ];
        return [...allRejectedUserIds, ...allRecipientsOfChats];
    });
}
function getMatches(userQueryOpts, currentUserId, currentPotentialMatches = []) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('getMatches, currentUserId: ', currentUserId);
            const currentUser = yield getUserById(currentUserId);
            console.log('currentUser: ', currentUser);
            if (!currentUser) {
                console.error('No user was attained from the database.');
                throw new Error('An error has occurred in getting the current user.');
            }
            const allUnshowableUserIds = yield getIdsOfUsersNotToShow(currentUserId);
            const potentialMatchesPaginationObj = yield queryForPotentialMatches(userQueryOpts, currentUser, allUnshowableUserIds, currentPotentialMatches);
            return { status: 200, data: Object.assign({}, potentialMatchesPaginationObj) };
        }
        catch (error) {
            console.error('An error has occurred in getting matches: ', error);
            const errMsg = `An error has occurred in getting matches for user: ${error}`;
            return { status: 500, msg: errMsg };
        }
    });
}
export { getMatches };
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
