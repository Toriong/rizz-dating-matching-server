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
function getMatches(userQueryOpts, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('generating query options...');
            const currentUser = yield getUserById(userId);
            if (!currentUser) {
                throw new Error('An error has occurred in getting the current user.');
            }
            // put the below into a function, call it: "getUsersNotToShow"
            const rejectedUsersQuery = {
                $or: [
                    { rejectedUserId: { $in: [userId] } },
                    { rejectorUserId: { $in: [userId] } }
                ]
            };
            const rejectedUsersThatCurrentUserIsInResult = yield getRejectedUsers(rejectedUsersQuery);
            const allUserChatsResult = yield getAllUserChats(userId);
            let allRecipientsOfChats;
            if (!allUserChatsResult.wasSuccessful) {
                console.error("Failed to get the chat users from the database.");
                throw new Error("Failed to get user chats from the database.");
            }
            allRecipientsOfChats = [
                ...new Set(allUserChatsResult.data
                    .flatMap(({ userAId, userBId }) => [userAId, userBId])
                    .filter(userId => currentUser._id !== userId))
            ];
            if ((rejectedUsersThatCurrentUserIsInResult.status !== 200) || !rejectedUsersThatCurrentUserIsInResult.data.length) {
                console.error('Failed to get the rejected users docs for the current user.');
                console.log('The current user either has not been rejected or has not rejected any users.');
            }
            const allRejectedUserIds = [
                ...new Set(rejectedUsersThatCurrentUserIsInResult.data
                    .flatMap((rejectedUserInfo) => {
                    return [rejectedUserInfo.rejectedUserId, rejectedUserInfo.rejectorUserId];
                })
                    .filter(userId => currentUser._id !== userId))
            ];
            const allUnshowableUserIds = [...allRejectedUserIds, ...allRecipientsOfChats];
            const potentialMatchesPaginationObj = yield queryForPotentialMatches(userQueryOpts, currentUser, allUnshowableUserIds);
            console.log('Potential matches has been attained. `potentialMatchesPaginationObj`: ', potentialMatchesPaginationObj);
            return { status: 200, data: Object.assign({}, potentialMatchesPaginationObj) };
        }
        catch (error) {
            console.error('An error has occurred in getting matches: ', error);
            const errMsg = `An error has occurred in getting matches for user: ${error}`;
            return { status: 500, msg: errMsg };
        }
        // GOAL #2: check if the result users have been either:
        // rejected by the current user (the user on the client side)
        // or has rejected the current user  
        // GOAL #3: Send the users to the client. 
    });
}
// this function will return an array of all of the users that the current user on the client side can match with. BRA
// BRAIN DUMP:
// this function will return an array with all of the users that the current user can view
// when the array is less than 5 after checking if the users in the potential matches array has been rejectd or if the user is currently chatting with the users, 
// invoke the function again with the next pagination to query for more users, and pass the current array of potential matches to the function 
function queryForPotentialMatches(userQueryOpts, currentUser, allUnshowableUserIds, currentPotentialMatches = []) {
    return __awaiter(this, void 0, void 0, function* () {
        const { userLocation, radiusInMilesInt, desiredAgeRange, skipDocsNum } = userQueryOpts;
        let updatedSkipDocsNum = skipDocsNum;
        const currentPageNum = skipDocsNum / 5;
        const METERS_IN_A_MILE = 1609.34;
        const [minAge, maxAge] = desiredAgeRange;
        const { latitude, longitude } = userLocation;
        console.log('getting matches for the user on the client side...');
        const paginationQueryOpts = {
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [longitude, latitude] },
                    $maxDistance: radiusInMilesInt * METERS_IN_A_MILE,
                }
            },
            sex: (currentUser.sex === 'male') ? 'female' : 'male',
            // sexAttraction: currentUser.sexAttraction,
            birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
        };
        const pageOpts = { skip: skipDocsNum, limit: 5 };
        Users.createIndexes([{ location: '2dsphere' }]);
        const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count();
        const potentialMatchesPromise = Users.find(paginationQueryOpts, null, pageOpts).sort({ ratingNum: 'desc' }).lean();
        let [totalUsersForQuery, pageQueryUsers] = yield Promise.all([totalUsersForQueryPromise, potentialMatchesPromise]);
        pageQueryUsers = pageQueryUsers.filter(({ _id }) => !allUnshowableUserIds.includes(_id));
        let potentialMatches = currentPotentialMatches;
        if (!pageQueryUsers.length) {
            const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: ((skipDocsNum / 5) + 1) * 5 });
            const results = yield queryForPotentialMatches(_userQueryOpts, currentUser, allUnshowableUserIds, potentialMatches);
            const { updatedPotentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum } = results;
            potentialMatches = updatedPotentialMatches;
            updatedSkipDocsNum = _updatedSkipDocsNum;
        }
        const sumBetweenPotentialMatchesAndPgQueryUsers = pageQueryUsers.length + potentialMatches.length;
        if (sumBetweenPotentialMatchesAndPgQueryUsers < 5) {
            potentialMatches = [...potentialMatches, ...pageQueryUsers];
            const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: ((skipDocsNum / 5) + 1) * 5 });
            const { updatedPotentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum } = yield queryForPotentialMatches(_userQueryOpts, currentUser, allUnshowableUserIds, potentialMatches);
            potentialMatches = updatedPotentialMatches;
            updatedSkipDocsNum = _updatedSkipDocsNum;
        }
        const endingSliceNum = 5 - potentialMatches.length;
        const usersToAddToMatches = pageQueryUsers.sort((userA, userB) => userB.ratingNum - userA.ratingNum).slice(0, endingSliceNum);
        potentialMatches = [...potentialMatches, ...usersToAddToMatches].sort((userA, userB) => userB.ratingNum - userA.ratingNum);
        return { updatedPotentialMatches: potentialMatches, updatedSkipDocsNum, canStillQueryCurrentPageForValidUsers: endingSliceNum < 5, hasReachedPaginationEnd: (5 * currentPageNum) >= totalUsersForQuery };
        // CASE: the sum is greater than 5
        // GOAL: get the highest rated users from the pageQueryUsers array and add them to the potentialMatches array in order to make the array 5. 
        // potentialMatches array is now 5, since q (the number that is need to make potential matches array 5) + x (current values in potentialMatches array) was computed
        // slice the pageQueryUsers arr according to how much users are need to make potentialMatches array 5, starting at index 0, this q
        // sort the pageQueryUsers arr from desc order according to the ratingNum   
        // given a variable z, and z is the remaineder that is needed to make potentialMatches 5, the following is computed for z: the difference between 5 and the current amount of users in x (current values in potentialMatches array)
        // WHAT IS HAPPENDING: 
        // there are users that were paged in the variable pageQueryUsers
        // CASE: there are less than 5 users in the potentialMatches array, and there are users in the pageQueryUsers array that are able to be added to the potentialMatches array, but not enough to make potentialMatches array to be 5
        // NOTES:
        // the following are true for this case: 
        // users in pageQueryUsers is y such that the following is true: 5 > y + x 
        // users in potentialMatches is x, and the following is true: 1 < x < 4
        // GOAL: the valid users are added to the potentialMatches array, and the next pagination is executed
        // and the arrays toether (x and y) 
        // the sum is less than 5
        // the sum is computed between y and x 
        // the users in potentialMathes is y
        // the users in pageQueryUsers is x
        // CASE: there are less than 5 users in the potentialMatches array, and there are enough users to be added to the array from the pageQueryUsers array. 
        // CASE: there are no users in the potentialMatches array, and there are not enough users to be added to the array from the pageQueryUsers array to make 5
        // CASE: there are no users in the potentialMatches array, and there are enough users to be added to the array to be make pageQueryUsers array to make 5 
        // check if there are any users that either blocked the current user or has been blocked by the current user
        // CASE: after checking if the any of the user has been rejected, the array is empty
        // execute this function again, go to the next pagination
        // CASE: after check if the any of the user has been chatting with the current user, the array is empty
        // execute the this function again, increase the pagination 
        // CASE: after checking if any of the user has been chatting with the current user, the array is less than 5 but greater than or equal to 1
        // call the function again and query for more users, pass the potentialMatches into the last argument
        // CASE: after checking if any of the users has been rejected by the current user or was rejected by the current user, the array is less than 5 but greater than or equal to 1
        // proceed to the next check: if the user is chatting with any of the users in the current array
    });
}
export { getMatches };
