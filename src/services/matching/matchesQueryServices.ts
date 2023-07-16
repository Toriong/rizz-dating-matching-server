import { User as Users, PaginatedModel, PaginationQueryingOpts, PaginationArgsOpts, ReturnTypeOfPaginateFn, UserBaseModelSchema, User } from "../../models/User.js"
import { UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";
import moment from "moment";
import { getUserById } from "../globalMongoDbServices.js";
import { getRejectedUsers } from "../rejectingUsers/rejectedUsersService.js";
import { getAllUserChats } from "../firebaseServices/firebaseDbServices.js";
import { RejectedUserInterface } from "../../types-and-interfaces/interfaces/rejectedUserDocsInterfaces.js";
import { IUserMatch, InterfacePotentialMatchesPage } from "../../types-and-interfaces/interfaces/matchesQueryInterfaces.js";
import { getMatchesWithPrompts } from "../promptsServices/getPromptsServices.js";
import { getMatchingPicUrlForUsers } from "./helper-fns/aws.js";

interface GetMatchesResult {
    status: number,
    data?: InterfacePotentialMatchesPage,
    msg?: string
}

interface IQueryOptsForPagination{
    skipAndLimitObj: {
        skip: number
        limit: number
    }, 
    paginationQueryOpts: PaginationQueryingOpts, 
    currentPageNum: number
}

function createQueryOptsForPagination(userQueryOpts: UserQueryOpts, currentUser: UserBaseModelSchema, allUnshowableUserIds: string[]): IQueryOptsForPagination {
    const { userLocation, minAndMaxDistanceArr, desiredAgeRange, skipDocsNum, isRadiusSetToAnywhere } = userQueryOpts;
    const currentPageNum = (skipDocsNum as number) / 5;
    const METERS_IN_A_MILE = 1609.34;
    const [minAge, maxAge] = desiredAgeRange;
    const paginationQueryOpts: PaginationQueryingOpts = {
        sex: (currentUser.sex === 'Male') ? 'Female' : 'Male',
        hasPrompts: true,
        sexAttraction: currentUser.sexAttraction,
        birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
    }

    if(allUnshowableUserIds?.length){
        paginationQueryOpts._id = { $nin: allUnshowableUserIds};
    }

    if (userLocation && minAndMaxDistanceArr && !isRadiusSetToAnywhere) {
        const [latitude, longitude] = userLocation as [number, number];
        const [minDistance, maxDistance] = minAndMaxDistanceArr as [number, number];
        paginationQueryOpts.location = {
            $near: {
                $geometry: { type: "Point", coordinates: [longitude, latitude] },
                $maxDistance: (maxDistance) * METERS_IN_A_MILE,
                $minDistance: (minDistance ?? 0) * METERS_IN_A_MILE
            }
        }
    }

    const skipAndLimitObj = { skip: skipDocsNum as number, limit: 5 };
    const returnVal = { skipAndLimitObj, paginationQueryOpts, currentPageNum };

    return returnVal;
}

async function queryForPotentialMatches(queryOptsForPagination: IQueryOptsForPagination, skipDocsNum: number): Promise<InterfacePotentialMatchesPage> {
    const { skipAndLimitObj, paginationQueryOpts, currentPageNum } = queryOptsForPagination;
    let updatedSkipDocsNum = skipDocsNum;

    (Users as any).createIndexes([{ location: '2dsphere' }])

    const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count()
    const potentialMatchesPromise = Users.find(paginationQueryOpts, null, skipAndLimitObj).sort({ ratingNum: 'desc' }).lean()
    let [totalUsersForQuery, potentialMatches]: [number, UserBaseModelSchema[]] = await Promise.all([totalUsersForQueryPromise, potentialMatchesPromise])
    const hasReachedPaginationEnd = (5 * currentPageNum) >= totalUsersForQuery;

    if (totalUsersForQuery === 0) {
        return { potentialMatches: [], updatedSkipDocsNum: 0, canStillQueryCurrentPageForUsers: false, hasReachedPaginationEnd: true }
    }


    if(hasReachedPaginationEnd){
        return { potentialMatches: potentialMatches, updatedSkipDocsNum: updatedSkipDocsNum, canStillQueryCurrentPageForUsers: false, hasReachedPaginationEnd: true}
    }

    return { potentialMatches: potentialMatches, updatedSkipDocsNum, hasReachedPaginationEnd: (5 * currentPageNum) >= totalUsersForQuery }
}

async function getIdsOfUsersNotToShow(currentUserId: string, rejectedUsers: RejectedUserInterface[], allRecipientsOfChats: string[]): Promise<string[]> {
    const allRejectedUserIds = [
        ...new Set((rejectedUsers)
            .flatMap((rejectedUserInfo: RejectedUserInterface) => {
                return [rejectedUserInfo.rejectedUserId, rejectedUserInfo.rejectorUserId]
            })
            .filter(userId => currentUserId !== userId))
    ]

    return [...allRejectedUserIds, ...allRecipientsOfChats]
}

// this function will only get the users based on queryOpts object

async function getMatches(queryOptsForPagination: IQueryOptsForPagination, skipDocsNum: number): Promise<GetMatchesResult> {
    try {
        const potentialMatchesPaginationObj = await queryForPotentialMatches(queryOptsForPagination, skipDocsNum);

        return { status: 200, data: { ...potentialMatchesPaginationObj } }
    } catch (error) {
        console.error('An error has occurred in getting matches: ', error)
        const errMsg = `An error has occurred in getting matches for user: ${error}`

        return { status: 500, msg: errMsg }
    }
}

async function getPromptsAndMatchingPicForClient(matches: IUserMatch[]){
    try{
        const matchesWithPromptsResult = await getMatchesWithPrompts(matches);

        if(!matchesWithPromptsResult.wasSuccessful){
            throw new Error('Failed to get prompts for matches.')
        }

        const matchesWithPicsResult = await getMatchingPicUrlForUsers(matchesWithPromptsResult.data as IUserMatch[])

        // get the location text for each user

        if(!matchesWithPicsResult.wasSuccessful){
            throw new Error('An error has occurred in getting matching pic for users.')
        }

        return { wasSuccessful: true, data: matchesWithPicsResult.data }
    } catch(error:any){
        console.error('Getting prompts and matching pic for client error: ', error);

        return { wasSuccessful: false, msg: 'Getting prompts and matching pic for client error: ' + error?.message }
    }
}

export { getMatches, createQueryOptsForPagination, getIdsOfUsersNotToShow, getPromptsAndMatchingPicForClient }


// FOR CHECKING WHAT USERS ARE ATTAINED BASED ON A SPECIFIC QUERY

        // const { userLocation, minAndMaxDistanceArr, desiredAgeRange, skipDocsNum, isRadiusSetToAnywhere } = userQueryOpts;

        // // CASE: 
        // // the user querying with a radius set

        // // GOAL:
        // // dynamically add the location field to the paginationQueryOpts object only if the following is true: 
        // // if userLocation is defined
        // // if minAndMaxDistanceArr is defined


        // // CASE:
        // // the user querying with the radius set to anywhere

        // // GOAL:
        // // don't add the location field to the queryOpts object

        // let updatedSkipDocsNum = skipDocsNum;
        // console.log('skipDocsNum: ', skipDocsNum)
        // // print minAndMaxDistanceArr
        // console.log('minAndMaxDistanceArr: ', minAndMaxDistanceArr)
        // const currentPageNum = (skipDocsNum as number) / 5;
        // console.log('currentPageNum: ', currentPageNum)
        // const METERS_IN_A_MILE = 1609.34;
        // const [minAge, maxAge] = desiredAgeRange;
        // const paginationQueryOpts: PaginationQueryingOpts = {
        //     sex: (currentUser.sex === 'Male') ? 'Female' : 'Male',
        //     hasPrompts: true,
        //     sexAttraction: currentUser.sexAttraction,
        //     birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
        // }

        // if (userLocation && minAndMaxDistanceArr && !isRadiusSetToAnywhere) {
        //     const [latitude, longitude] = userLocation as [number, number];
        //     const [minDistance, maxDistance] = minAndMaxDistanceArr as [number, number];
        //     paginationQueryOpts.location = {
        //         $near: {
        //             $geometry: { type: "Point", coordinates: [longitude, latitude] },
        //             $maxDistance: (maxDistance) * METERS_IN_A_MILE,
        //             $minDistance: (minDistance) * METERS_IN_A_MILE
        //         }
        //     }
        // }

        // console.log("isRadiusSetToAnywhere: ", isRadiusSetToAnywhere)

        // if ((isRadiusSetToAnywhere === 'true') && Boolean(isRadiusSetToAnywhere)) {
        //     paginationQueryOpts._id = { $nin: allUnshowableUserIds }
        // }

        // const pageOpts = { skip: 50, limit: 5 };

        // (Users as any).createIndexes([{ location: '2dsphere' }])

        // const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count()
        // const potentialMatchesPromise = Users.find(paginationQueryOpts, null, pageOpts).sort({ ratingNum: 'desc' }).lean()
        // let [totalUsersForQuery, pageQueryUsers]: [number, UserBaseModelSchema[]] = await Promise.all([totalUsersForQueryPromise, potentialMatchesPromise])

        // return { status: 200, data: { potentialMatches: pageQueryUsers, updatedSkipDocsNum: 5, canStillQueryCurrentPageForUsers: true, hasReachedPaginationEnd: false } }

        // THE ABOVE IS FOR CHECKING WHAT USERS ARE ATTAINED BASED ON A SPECIFIC QUERY
