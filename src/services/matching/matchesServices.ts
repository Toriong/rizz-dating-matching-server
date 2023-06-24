import mongoose from "mongoose";
import { User as Users, PaginatedModel, PaginationQueryingOpts, PaginationArgsOpts, ReturnTypeOfPaginateFn, UserBaseModelSchema } from "../../models/User.js"
import { UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";
import { get } from "http";
import moment, { Moment } from "moment";


interface GetMatchesResult {
    status: number,
    data?: ReturnTypeOfPaginateFn,
    msg?: string
}

function getFormattedBirthDate(birthDate: Date): string {
    const month = ((birthDate.getMonth() + 1).toString().length > 1) ? (birthDate.getMonth() + 1) : `0${(birthDate.getMonth() + 1)}`
    const day = (birthDate.getDay().toString().length > 1) ? birthDate.getDay() + 1 : `0${birthDate.getDay() + 1}`

    return `${birthDate.getFullYear()}-${month}-${day}`
}

async function getMatches(userQueryOpts: UserQueryOpts): Promise<GetMatchesResult> {

    console.log('userQueryOpts: ', userQueryOpts)

    try {

        console.log('generating query options...')

        const METERS_IN_A_MILE = 1609.34;
        const { userLocation, radiusInMilesInt, desiredSex, desiredAgeRange, paginationPageNum } = userQueryOpts;
        const [minAge, maxAge] = desiredAgeRange;
        const { latitude, longitude } = userLocation;
        console.log('typeof latitude: ', typeof latitude)
        const paginationQueryOpts: PaginationQueryingOpts = {
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [longitude, latitude] },
                    $maxDistance: 10_000 * METERS_IN_A_MILE,
                }
            },
            sex: desiredSex,
            birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
        }

        console.log('paginationQueryOpts: ', paginationQueryOpts)

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

        
        // FIREBASE DB CASES: 
        // CASE: for the first three pagination, all of users has sent a match request to the current user, the fourth pagination only three users has sent a 
        // match request to the currenet user, the fifth pagination, all users has sent a pagination to the current user, the sixth pagination, only one user 
        // has sent a match request.
        // GOAL: get the matches to send the client. There should be two users from the fourth paginations, three users from the sixth paginaton.

        // CASE: for the first pagination, the current user has sent match request, the second pagination, the current user has sent a match request to a user, 
        // the third pagination, all of the user has neither sent a match request or receieved a match request to and from the current user respectively.
        // GOAL: send the matches to the client. the second pagination, the user that received the match request from the current user is not present, four users from the third pagination is 
        // present in the potential matches array 
        
        // send the following info back to the client:
        // the users to display on the client side
        // if it is the last page for the user to page through
        // if there a still more viewable users to query in the current page (areMoreUsersToQueryInCurrentPage, if true, then send query using the same page num)

        

        const pageOpts = { page: paginationPageNum, limit: 5 }
        await (Users as any).createIndexes([{ location: '2dsphere' }])
        const potentialMatches = await Users.find(paginationQueryOpts, null, pageOpts).sort({ ratingNum: 'desc' })

        // determine if the pagination is the last pagination page that the user can perform
        
        // CASE: there are less than 5 users in the pagination
        // GOAL: the user is on the last pagination page, set isLast to true

        // GOAL: using the ids of the users of the potential matches, check if they have rejected the current user. If so, then filter that user out


        // MONGO DB CASES, REJECTED CURRENT USER OR WAS REJECTED BY CURRENT USER:

        // CASE: there is at least one user that rejected the current user, all of the proceeding paginations has rejected user, except for the fourth pagination. There is a replacement for the user that rejected the current user
        // GOAL: get the user to display for the matches from the first pagination (only four) and the fourth pagination (only one)

        // CASE: 
        // the users in the first, second, third, fourth paginations, has rejected the current user
        // for the fifth pagination, two users were rejected by the current user
        // GOAL: on the fifth pagination, get the user with the highest rating, and replace the users that rejected the current user or was rejected by the current user

        // CASE: 
        // all of the user in the user's given location radius has rejected the current user
        // GOAL: send an empty array to the client and tell the client to increase their radius for matching 



        return { status: 200 }
    } catch (error) {
        const errMsg = `An error has occurred in getting matches for user: ${error}`

        return { status: 500, msg: errMsg }
    }

    // GOAL #2: check if the result users have been either:
    // rejected by the current user (the user on the client side)
    // or has rejected the current user  

    // GOAL #3: Send the users to the client. 
}

export { getMatches }