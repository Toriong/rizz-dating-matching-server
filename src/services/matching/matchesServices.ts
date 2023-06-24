import mongoose from "mongoose";
import { User as Users, PaginatedModel, PaginationQueryingOpts, PaginationArgsOpts, ReturnTypeOfPaginateFn } from "../../models/User.js"
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
                    $geometry: { type: "Point", coordinates: [latitude, longitude] },
                    $maxDistance: radiusInMilesInt * METERS_IN_A_MILE,
                }
            },
            sex: desiredSex,
            birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
        }

        console.log('paginationQueryOpts: ', paginationQueryOpts)

        const paginationArgsOpts: PaginationArgsOpts = {
            query: paginationQueryOpts,
            sort: { ratingNum: -1 },
            page: paginationPageNum,
            limit: 5
        }

        console.log('query options has been generated.')

        // console.log('paginationArgsOpts: ', paginationArgsOpts)

        console.log('getting matches for the user on the client side...');



        // const potentialMatchesPageInfo = await (Users as any).paginate({ query: { sex: 'Female' }, birthDate: { $gt: new Date(desiredAgeRange[0]), $lt: new Date(desiredAgeRange[1]) } })
        // location: {
        //     $near: {
        //         $geometry: { type: "Point", coordinates: [longitude, latitude]  },
        //     }
        // },
        let minAgeDateStr: string | Moment = getFormattedBirthDate(new Date(minAge))
        minAgeDateStr = moment.utc(minAgeDateStr)
        let maxAgeDateStr: string | Moment = getFormattedBirthDate(new Date(maxAge))
        maxAgeDateStr = moment.utc(maxAgeDateStr)
        const pageOpts = { page: paginationPageNum, limit: 5 }
        const potentialMatchesPageInfo = await Users.find({ sex: desiredSex, birthDate: { $gte: minAgeDateStr.toDate() } }, null, pageOpts).sort({ ratingNum: 'desc' })

        console.log('potentialMatchesPageInfo: ', potentialMatchesPageInfo.length)

        // const potentialMatchesPageInfo = await (Users as PaginatedModel).paginate({
        //     query: {
        //         location: {
        //             $near: {
        //                 $geometry: { type: "Point", coordinates: [latitude, longitude] },
        //                 $maxDistance: radiusInMilesInt * METERS_IN_A_MILE,
        //             }
        //         },
        //         sex: desiredSex,
        // birthDate: { $gt: minAge, $lt: maxAge }
        //     },
        //     page: 1,
        //     limit: 5,
        //     sort: { ratingNum: -1 }
        //     // birthDate: { $gt: desiredAgeRange[0], $lt: desiredAgeRange[1] }
        // })


        // console.log('potentialMatchesPageInfo?.docs: ', potentialMatchesPageInfo?.docs)

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