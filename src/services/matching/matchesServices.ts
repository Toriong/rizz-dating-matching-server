import { User as Users, PaginatedModel, PaginationQueryingOpts, PaginationArgsOpts, ReturnTypeOfPaginateFn } from "../../models/User.js"
import { UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";


interface GetMatchesResult{
    status: number,
    data?: ReturnTypeOfPaginateFn,
    msg?: string
}

async function getMatches(userQueryOpts: UserQueryOpts): Promise<GetMatchesResult> {

    console.log('userQueryOpts: ', userQueryOpts)

    try{

        console.log('generating query options...')

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

        console.log('paginationQueryOpts: ', paginationQueryOpts)

        const paginationArgsOpts:PaginationArgsOpts = {
            query: paginationQueryOpts,
            sort: { ratingNum: -1 },
            page: paginationPageNum,
            limit: 5
        }

        console.log('query options has been generated.')

        console.log('paginationArgsOpts: ', paginationArgsOpts)

        console.log('getting matches for the user on the client side...')

        const potentialMatchesPageInfo = await (Users as PaginatedModel).paginate(paginationArgsOpts)

        console.log('potentialMatchesPageInfo: ', potentialMatchesPageInfo)

        return { status: 200, data: potentialMatchesPageInfo }
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