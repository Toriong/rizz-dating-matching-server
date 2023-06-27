import mongoose from "mongoose";
import { User as Users, PaginatedModel, PaginationQueryingOpts, PaginationArgsOpts, ReturnTypeOfPaginateFn, UserBaseModelSchema, User } from "../../models/User.js"
import { UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";
import { get } from "http";
import moment, { Moment } from "moment";
import getFirebaseInfo from "../firebaseServices/helper-fns/connectToFirebase.js";
import { getUserById } from "../globalMongoDbServices.js";
import { getRejectedUsers } from "../rejectingUsers/rejectedUsersService.js";


interface GetMatchesResult {
    status: number,
    data?: any,
    msg?: string
}

function getFormattedBirthDate(birthDate: Date): string {
    const month = ((birthDate.getMonth() + 1).toString().length > 1) ? (birthDate.getMonth() + 1) : `0${(birthDate.getMonth() + 1)}`
    const day = (birthDate.getDay().toString().length > 1) ? birthDate.getDay() + 1 : `0${birthDate.getDay() + 1}`

    return `${birthDate.getFullYear()}-${month}-${day}`
}

async function getMatches(userQueryOpts: UserQueryOpts, userId: string): Promise<GetMatchesResult> {
    try {
        console.log('generating query options...')
        const firebaseInfo = getFirebaseInfo()
        const currentUser = await getUserById(userId)
        const rejectUserDocsThatCurrentUserIsIn = await getRejectedUsers({ rejectedUserId: { $in: [userId] } })

        if (!currentUser) {
            throw new Error('An error has occurred in getting the current user.')
        }

        const METERS_IN_A_MILE = 1609.34;
        const { userLocation, radiusInMilesInt, desiredAgeRange, paginationPageNum } = userQueryOpts;
        const [minAge, maxAge] = desiredAgeRange;
        const { latitude, longitude } = userLocation;

        console.log('getting matches for the user on the client side...');

        const paginationQueryOpts: PaginationQueryingOpts = {
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [longitude as number, latitude as number] },
                    $maxDistance: (radiusInMilesInt as number) * METERS_IN_A_MILE,
                }
            },
            sex: (currentUser.sex === 'male') ? 'female' : 'male',
            birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
        }
        const pageOpts = { skip: paginationPageNum as number, limit: 5 };

        (Users as any).createIndexes([{ location: '2dsphere' }])

        const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count()
        const potentialMatchesPromise = Users.find(paginationQueryOpts, null, pageOpts).sort({ ratingNum: 'desc' }).exec()
        const [totalUsersForQuery, potentialMatches]: [number, unknown] = await Promise.all([totalUsersForQueryPromise, potentialMatchesPromise])

        return { status: 200, data: { potentialMatches: potentialMatches, doesCurrentPgHaveAvailableUsers: false } }
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