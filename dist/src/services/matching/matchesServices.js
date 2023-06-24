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
function getMatches(userQueryOpts) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('userQueryOpts: ', userQueryOpts);
        try {
            console.log('generating query options...');
            const METERS_IN_A_MILE = 1609.34;
            const { userLocation, radiusInMilesInt, desiredSex, desiredAgeRange, paginationPageNum } = userQueryOpts;
            const { latitude, longitude } = userLocation;
            const paginationQueryOpts = {
                location: {
                    $near: {
                        $geometry: { type: "Point", coordinates: [latitude, longitude] },
                        $maxDistance: radiusInMilesInt * METERS_IN_A_MILE,
                    }
                },
                sex: desiredSex,
                birthDate: { $gt: new Date(desiredAgeRange[0]), $lt: new Date(desiredAgeRange[1]) }
            };
            console.log('paginationQueryOpts: ', paginationQueryOpts);
            const paginationArgsOpts = {
                query: paginationQueryOpts,
                sort: { ratingNum: -1 },
                page: paginationPageNum,
                limit: 5
            };
            console.log('query options has been generated.');
            console.log('paginationArgsOpts: ', paginationArgsOpts);
            console.log('getting matches for the user on the client side...');
            const USERS = Users;
            console.log('USERS.paginate: ', USERS.paginate);
            const potentialMatchesPageInfo = yield Users.paginate(paginationArgsOpts);
            console.log('potentialMatchesPageInfo: ', potentialMatchesPageInfo);
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
