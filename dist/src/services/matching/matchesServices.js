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
function getFormattedBirthDate(birthDate) {
    const month = ((birthDate.getMonth() + 1).toString().length > 1) ? (birthDate.getMonth() + 1) : `0${(birthDate.getMonth() + 1)}`;
    const day = (birthDate.getDay().toString().length > 1) ? birthDate.getDay() + 1 : `0${birthDate.getDay() + 1}`;
    return `${birthDate.getFullYear()}-${month}-${day}`;
}
function getMatches(userQueryOpts) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('userQueryOpts: ', userQueryOpts);
        try {
            console.log('generating query options...');
            const METERS_IN_A_MILE = 1609.34;
            const { userLocation, radiusInMilesInt, desiredSex, desiredAgeRange, paginationPageNum } = userQueryOpts;
            const [minAge, maxAge] = desiredAgeRange;
            const { latitude, longitude } = userLocation;
            console.log('typeof latitude: ', typeof latitude);
            const paginationQueryOpts = {
                location: {
                    $near: {
                        $geometry: { type: "Point", coordinates: [longitude, latitude] },
                        $maxDistance: 10000 * METERS_IN_A_MILE,
                    }
                },
                sex: desiredSex,
                birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
            };
            console.log('paginationQueryOpts: ', paginationQueryOpts);
            console.log('getting matches for the user on the client side...');
            // const potentialMatchesPageInfo = await (Users as any).paginate({ query: { sex: 'Female' }, birthDate: { $gt: new Date(desiredAgeRange[0]), $lt: new Date(desiredAgeRange[1]) } })
            // location: {
            //     $near: {
            //         $geometry: { type: "Point", coordinates: [longitude, latitude]  },
            //     }
            // },
            // let minAgeDateStr: string | Moment = getFormattedBirthDate(new Date(minAge))
            // minAgeDateStr = moment.utc(minAgeDateStr)
            // let maxAgeDateStr: string | Moment = getFormattedBirthDate(new Date(maxAge))
            // maxAgeDateStr = moment.utc(maxAgeDateStr)
            // for the first query: 
            //         '01H2S38KJAF0WDQAGHFNFP78X8',
            // [1]   '01H2S38CK68Z9AE4H0ZSX4SS7C',
            // [1]   '01H2S38HGJXEM5Q0RSS05FSJXX'
            // GOAL: connect to the firebase database in order to check if the current user received a match request from the specified user or has sent a match request to the specified user
            // BRAIN DUMP:
            // the user can respond to a match in the following ways:
            // by sending match request to the user
            // or rejecting the user
            // CASE: the user received a match request from the specified user
            // GOAL: delete this user from the potential matches array
            // CASE: sent a match request to a user
            // GOAL: delete this user from the potential matches array
            // CASE: the current user has rejected the potential match user or the potential match user has rejected the current user
            // GOAL: delete this user from the potential matches array
            // send the following info back to the client:
            // the users to display on the client side
            // if it is the last page for the user to page through
            const pageOpts = { page: paginationPageNum, limit: 5 };
            yield Users.createIndexes([{ location: '2dsphere' }]);
            const potentialMatches = yield Users.find(paginationQueryOpts, null, pageOpts).sort({ ratingNum: 'desc' });
            // determine if the pagination is the last pagination page that the user can perform
            // CASE: there are less than 5 users in the pagination
            // GOAL: the user is on the last pagination page, set isLast to true
            // GOAL: using the ids of the users of the potential matches, check if they have rejected the current user. If so, then filter that user out
            // CASE: there is at least one user that rejected the current user, get the next pagination pages, on the fourth pagination, there is a replacement for the user that rejected the current user
            // GOAL: get the next pagination
            // CASE: 
            // the users in the second, third, fourth paginations, has rejected the current user
            // for the fifth pagination, two users were rejected by the current user
            // GOAL: on the fifth pagination, get the user with the highest rating, and replace the users that rejected the current user or was rejected by the current user
            return { status: 200 };
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
