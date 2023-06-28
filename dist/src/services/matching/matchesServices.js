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
            const METERS_IN_A_MILE = 1609.34;
            const { userLocation, radiusInMilesInt, desiredAgeRange, paginationPageNum } = userQueryOpts;
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
                birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
            };
            const pageOpts = { skip: paginationPageNum, limit: 5 };
            Users.createIndexes([{ location: '2dsphere' }]);
            const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count();
            const potentialMatchesPromise = Users.find(paginationQueryOpts, null, pageOpts).sort({ ratingNum: 'desc' }).exec();
            const [totalUsersForQuery, potentialMatches] = yield Promise.all([totalUsersForQueryPromise, potentialMatchesPromise]);
            return { status: 200, data: { potentialMatches: potentialMatches, doesCurrentPgHaveAvailableUsers: false } };
        }
        catch (error) {
            const errMsg = `An error has occurred in getting matches for user: ${error}`;
            return { status: 500, msg: errMsg };
        }
        // GOAL #2: check if the result users have been either:
        // rejected by the current user (the user on the client side)
        // or has rejected the current user  
        // GOAL #3: Send the users to the client. 
    });
}
export { getMatches };
