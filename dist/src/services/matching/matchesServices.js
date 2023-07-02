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
function getFormattedBirthDate(birthDate) {
    const month = ((birthDate.getMonth() + 1).toString().length > 1) ? (birthDate.getMonth() + 1) : `0${(birthDate.getMonth() + 1)}`;
    const day = (birthDate.getDay().toString().length > 1) ? birthDate.getDay() + 1 : `0${birthDate.getDay() + 1}`;
    return `${birthDate.getFullYear()}-${month}-${day}`;
}
function queryForPotentialMatches(userQueryOpts, currentUser, allUnshowableUserIds, currentPotentialMatches = []) {
    return __awaiter(this, void 0, void 0, function* () {
        // put the below into a funtion, call it: createQueryOptsForPagination
        const { userLocation, radiusInMilesInt, desiredAgeRange, skipDocsNum } = userQueryOpts;
        let updatedSkipDocsNum = skipDocsNum;
        console.log('skipDocsNum: ', skipDocsNum);
        const currentPageNum = skipDocsNum / 5;
        console.log('currentPageNum: ', currentPageNum);
        const METERS_IN_A_MILE = 1609.34;
        const [minAge, maxAge] = desiredAgeRange;
        const { latitude, longitude } = userLocation;
        const paginationQueryOpts = {
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [longitude, latitude] },
                    $maxDistance: radiusInMilesInt * METERS_IN_A_MILE,
                }
            },
            sex: (currentUser.sex === 'Male') ? 'Female' : 'Male',
            hasPrompts: true,
            // sexAttraction: currentUser.sexAttraction,
            birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
        };
        const pageOpts = { skip: skipDocsNum, limit: 5 };
        // put the above into a function
        Users.createIndexes([{ location: '2dsphere' }]);
        // GOAL: make a dummy query to get the last page of users. These users will have no prompts. Query for more users. Those users
        // will not have prompts as well
        const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count();
        const potentialMatchesPromise = Users.find(paginationQueryOpts, null, pageOpts).sort({ ratingNum: 'desc' }).lean();
        let [totalUsersForQuery, pageQueryUsers] = yield Promise.all([totalUsersForQueryPromise, potentialMatchesPromise]);
        if (totalUsersForQuery === 0) {
            return { potentialMatches: [], updatedSkipDocsNum: 0, canStillQueryCurrentPageForValidUsers: false, hasReachedPaginationEnd: true };
        }
        pageQueryUsers = pageQueryUsers.filter(({ _id }) => !allUnshowableUserIds.includes(_id));
        let potentialMatches = currentPotentialMatches;
        if (!pageQueryUsers.length) {
            console.log('no users were found for the current query.');
            const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: ((skipDocsNum / 5) + 1) * 5 });
            const results = yield queryForPotentialMatches(_userQueryOpts, currentUser, allUnshowableUserIds, potentialMatches);
            const { potentialMatches: updatedPotentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum } = results;
            potentialMatches = updatedPotentialMatches;
            updatedSkipDocsNum = _updatedSkipDocsNum;
        }
        const sumBetweenPotentialMatchesAndPgQueryUsers = pageQueryUsers.length + potentialMatches.length;
        if (sumBetweenPotentialMatchesAndPgQueryUsers < 5) {
            console.log('Not enough user to display to the user on the client side, querying for more users...');
            potentialMatches = [...potentialMatches, ...pageQueryUsers];
            const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: ((skipDocsNum / 5) + 1) * 5 });
            const { potentialMatches: updatedPotentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum } = yield queryForPotentialMatches(_userQueryOpts, currentUser, allUnshowableUserIds, potentialMatches);
            potentialMatches = updatedPotentialMatches;
            updatedSkipDocsNum = _updatedSkipDocsNum;
        }
        const endingSliceNum = 5 - potentialMatches.length;
        const usersToAddToMatches = pageQueryUsers.sort((userA, userB) => userB.ratingNum - userA.ratingNum).slice(0, endingSliceNum);
        potentialMatches = [...potentialMatches, ...usersToAddToMatches].sort((userA, userB) => userB.ratingNum - userA.ratingNum);
        return { potentialMatches: potentialMatches, updatedSkipDocsNum, canStillQueryCurrentPageForValidUsers: endingSliceNum < 5, hasReachedPaginationEnd: (5 * currentPageNum) >= totalUsersForQuery };
    });
}
function getMatches(userQueryOpts, currentUserId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('generating query options...');
            console.log('getMatches, currentUserId: ', currentUserId);
            const currentUser = yield getUserById(currentUserId);
            console.log('currentUser: ', currentUser);
            if (!currentUser) {
                console.error('No user was attained from the database.');
                throw new Error('An error has occurred in getting the current user.');
            }
            // put the below into a function, call it: "getUsersNotToShow"
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
            const allUnshowableUserIds = [...allRejectedUserIds, ...allRecipientsOfChats];
            // THIS IS ALL TESTING CODE
            // const { userLocation, radiusInMilesInt, desiredAgeRange, skipDocsNum } = userQueryOpts;
            // let updatedSkipDocsNum = skipDocsNum;
            // console.log('skipDocsNum: ', skipDocsNum)
            // const currentPageNum = (skipDocsNum as number) / 5;
            // console.log('currentPageNum: ', currentPageNum)
            // const METERS_IN_A_MILE = 1609.34;
            // const [minAge, maxAge] = desiredAgeRange;
            // const { latitude, longitude } = userLocation;
            // const paginationQueryOpts: PaginationQueryingOpts = {
            //     location: {
            //         $near: {
            //             $geometry: { type: "Point", coordinates: [longitude as number, latitude as number] },
            //             $maxDistance: (radiusInMilesInt as number) * METERS_IN_A_MILE,
            //         }
            //     },
            //     sex: (currentUser.sex === 'Male') ? 'Female' : 'Male',
            //     hasPrompts: true,
            //     // sexAttraction: currentUser.sexAttraction,
            //     birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
            // }
            // const pageOpts = { skip: 80, limit: 5 };
            // (Users as any).createIndexes([{ location: '2dsphere' }])
            // const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count()
            // const potentialMatchesPromise = Users.find(paginationQueryOpts, null, pageOpts).sort({ ratingNum: 'desc' }).lean()
            // let [totalUsersForQuery, pageQueryUsers]: [number, UserBaseModelSchema[]] = await Promise.all([totalUsersForQueryPromise, potentialMatchesPromise])
            // THE ABOVE IS TESTING CODE
            const potentialMatchesPaginationObj = yield queryForPotentialMatches(userQueryOpts, currentUser, allUnshowableUserIds);
            // GOAL: get the following:
            // prompts
            // hobbies 
            // their matching pic
            // their name 
            // their location
            // CASE: at least one of the user no longer has any prompts, so we need to query for more users
            // CASE: all users has prompts
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
