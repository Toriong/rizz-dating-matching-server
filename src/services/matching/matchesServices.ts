import { User as Users, PaginatedModel, PaginationQueryingOpts, PaginationArgsOpts, ReturnTypeOfPaginateFn } from "../../models/User.js"
import { UserLocation } from "../../types-and-interfaces/interfaces.js"

type Sex = 'Female' | 'Male'
interface UserQueryOpts {
    desiredSex: Sex,
    userLocation: UserLocation,
    radiusInMilesInt: number,
    desiredAgeRange: [Date, Date],
    paginationPageNum: number
}

interface GetMatchesResult{
    status: number,
    data?: ReturnTypeOfPaginateFn,
    msg?: string
}

async function getMatches(userQueryOpts: UserQueryOpts): Promise<GetMatchesResult> {
    try{
        const METERS_IN_A_MILE = 1609.34;
        const { userLocation, radiusInMilesInt, desiredSex, desiredAgeRange, paginationPageNum } = userQueryOpts;
        const { latitude, longitude } = userLocation;
        const paginationQueryOpts: PaginationQueryingOpts = {
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [latitude, longitude] },
                    $maxDistance: radiusInMilesInt * METERS_IN_A_MILE,
                }
            },
            sex: desiredSex,
            birthDate: { $gt: new Date(desiredAgeRange[0]), $lt: new Date(desiredAgeRange[1]) }
        }
        const paginationArgsOpts:PaginationArgsOpts = {
            query: paginationQueryOpts,
            sort: { ratingNum: -1 },
            page: paginationPageNum,
            limit: 5
        }
        const potentialMatches = await (Users as PaginatedModel).paginate(paginationArgsOpts)

        return { status: 200, data: potentialMatches }
    } catch(error){
        const errMsg = `An error has occurred in getting matches for user: ${error}`

        return { status: 500, msg: errMsg }
    }

    // GOAL #2: check if the result users have been either:
    // rejected by the current user (the user on the client side)
    // or has rejected the current user  

    // GOAL #3: Send the users to the client. 
}

export { getMatches }