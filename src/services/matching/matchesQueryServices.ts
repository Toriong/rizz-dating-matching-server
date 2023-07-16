import mongoose from "mongoose";
import { User as Users, PaginatedModel, PaginationQueryingOpts, PaginationArgsOpts, ReturnTypeOfPaginateFn, UserBaseModelSchema, User } from "../../models/User.js"
import { UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";
import moment from "moment";
import { getUserById } from "../globalMongoDbServices.js";
import { getRejectedUsers } from "../rejectingUsers/rejectedUsersService.js";
import { getAllUserChats } from "../firebaseServices/firebaseDbServices.js";
import { RejectedUserInterface } from "../../types-and-interfaces/interfaces/rejectedUserDocsInterfaces.js";
import { InterfacePotentialMatchesPage } from "../../types-and-interfaces/interfaces/matchesQueryInterfaces.js";

// NOTES:
// the 'main' functions for this file are the functions that return values to their respective route file
// the helper functios are the functions that help out the main functions


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

function createQueryOptsForPagination(userQueryOpts: UserQueryOpts, currentUser: UserBaseModelSchema, allUnshowableUserIds: string[] | null = null): IQueryOptsForPagination {
    const { userLocation, minAndMaxDistanceArr, desiredAgeRange, skipDocsNum, isRadiusSetToAnywhere } = userQueryOpts;
    console.log("userQueryOpts: ", userQueryOpts)
    console.log('skipDocsNum: ', skipDocsNum)
    const currentPageNum = (skipDocsNum as number) / 5;
    console.log('currentPageNum: ', currentPageNum)
    const METERS_IN_A_MILE = 1609.34;
    const [minAge, maxAge] = desiredAgeRange;
    const paginationQueryOpts: PaginationQueryingOpts = {
        sex: (currentUser.sex === 'Male') ? 'Female' : 'Male',
        hasPrompts: true,
        sexAttraction: currentUser.sexAttraction,
        birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
    }

    console.log('adding long, lat, distance query if sent from client...')
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


    if (isRadiusSetToAnywhere && allUnshowableUserIds?.length) {
        paginationQueryOpts._id = { $nin: allUnshowableUserIds }
    }

    const skipAndLimitObj = { skip: skipDocsNum as number, limit: 5 };
    const returnVal = { skipAndLimitObj, paginationQueryOpts, currentPageNum };

    console.log("returnVal: ", returnVal);
    console.log("paginationQueryOpts: ", paginationQueryOpts)

    return returnVal;
}

async function queryForPotentialMatches(userQueryOpts: UserQueryOpts, currentUser: UserBaseModelSchema, allUnshowableUserIds: string[], currentPotentialMatches: UserBaseModelSchema[] = []): Promise<InterfacePotentialMatchesPage> {
    const { skipAndLimitObj, paginationQueryOpts, currentPageNum } = createQueryOptsForPagination(userQueryOpts, currentUser, allUnshowableUserIds);
    let updatedSkipDocsNum = userQueryOpts.skipDocsNum;

    console.log('currentPotentialMatches: ', currentPotentialMatches);
    console.log('allUnshowableUserIds: ', allUnshowableUserIds);

    (Users as any).createIndexes([{ location: '2dsphere' }])

    const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count()
    const potentialMatchesPromise = Users.find(paginationQueryOpts, null, skipAndLimitObj).sort({ ratingNum: 'desc' }).lean()
    let [totalUsersForQuery, pageQueryUsers]: [number, UserBaseModelSchema[]] = await Promise.all([totalUsersForQueryPromise, potentialMatchesPromise])
    // GOAL: for the pageQueryUsers array, filter out all of the users that are in the currentPotentialMatches array
    // filter out any of the users in the pageQueryUsers array if they appear in the currentPotentialMatches array 
    const currentPotentialMatchesIds = currentPotentialMatches.map(({ _id }) => _id);
    console.log('currentPotentialMatchesIds: ', currentPotentialMatchesIds)
    console.log('currentPotentialMactchesIds: ', currentPotentialMatches.length)
    console.log('pageQueryUsers filtered: ', pageQueryUsers.filter(({ _id }) => !currentPotentialMatchesIds.includes(_id)))
    const hasReachedPaginationEnd = (5 * currentPageNum) >= totalUsersForQuery;
    console.log("totalUsersForQuery: ",totalUsersForQuery)
    console.log("hasReachedPaginationEnd: ", hasReachedPaginationEnd)

    if (totalUsersForQuery === 0) {
        return { potentialMatches: [], updatedSkipDocsNum: 0, canStillQueryCurrentPageForUsers: false, hasReachedPaginationEnd: true }
    }

    pageQueryUsers = pageQueryUsers.filter(({ _id }) => !allUnshowableUserIds.includes(_id))
    let potentialMatches = currentPotentialMatches;

    if(hasReachedPaginationEnd){
        return { potentialMatches: potentialMatches, updatedSkipDocsNum: updatedSkipDocsNum, canStillQueryCurrentPageForUsers: false, hasReachedPaginationEnd: true}
    }

    if (!pageQueryUsers.length && !hasReachedPaginationEnd) {
        console.log('no users were found for the current query.')
        const _userQueryOpts = { ...userQueryOpts, skipDocsNum: (((userQueryOpts.skipDocsNum as number) / 5) + 1) * 5 }
        const results = await queryForPotentialMatches(_userQueryOpts, currentUser, allUnshowableUserIds, potentialMatches)
        const { potentialMatches: updatedPotentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum } = results;
        potentialMatches = updatedPotentialMatches?.length ? updatedPotentialMatches : [];
        updatedSkipDocsNum = _updatedSkipDocsNum as number;
    }

    const sumBetweenPotentialMatchesAndPgQueryUsers = pageQueryUsers.length + potentialMatches.length

    if ((sumBetweenPotentialMatchesAndPgQueryUsers < 5) && (sumBetweenPotentialMatchesAndPgQueryUsers > 0)) {
        console.log('Not enough user to display to the user on the client side, querying for more users...')
        // print out the ids of potentialMatches and pageQueryUsers
        console.log('potentialMatches ids: ', potentialMatches.map(({ _id }) => _id))
        console.log('pageQueryUsers: ', pageQueryUsers.map(({ _id }) => _id))
        // before the below step, delete any of the users in the pageQueryUsers array if they appear in the currentPotentialMatches array
        potentialMatches = [...potentialMatches, ...pageQueryUsers]
        // put the below into a function
        const _userQueryOpts = { ...userQueryOpts, skipDocsNum: (((userQueryOpts.skipDocsNum as number) / 5) + 1) * 5 }
        const queryForPotentialMatchesResultsObj = await queryForPotentialMatches(_userQueryOpts, currentUser, allUnshowableUserIds, potentialMatches)
        const { potentialMatches: updatedPotentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum } = queryForPotentialMatchesResultsObj
        console.log("updatedPotentialMatches: ", updatedPotentialMatches)
        potentialMatches = updatedPotentialMatches?.length ? updatedPotentialMatches : [];
        updatedSkipDocsNum = _updatedSkipDocsNum as number;
        // put the above into a function
    }

    let endingSliceNum = 5;

    if (sumBetweenPotentialMatchesAndPgQueryUsers > 0) {
        console.log('Getting users to add to the existing potential matches array.')
        endingSliceNum = 5 - potentialMatches.length
        console.log("endingSliceNum: ", endingSliceNum)
        console.log('pageQueryUsers: ', pageQueryUsers)
        console.log("potentialMatches: ", potentialMatches)
        const usersToAddToMatches = pageQueryUsers.sort((userA, userB) => userB.ratingNum - userA.ratingNum).slice(0, endingSliceNum)
        potentialMatches = [...potentialMatches, ...usersToAddToMatches].sort((userA, userB) => userB.ratingNum - userA.ratingNum)
    }

    console.log('Returning potential matches page info...')

    // WHERE IS THE DUPLCATION OCCURING? 
    // check the third conditional scope, check if the duplication is occuring there

    return { potentialMatches: potentialMatches, updatedSkipDocsNum, canStillQueryCurrentPageForUsers: endingSliceNum < 5, hasReachedPaginationEnd: (5 * currentPageNum) >= totalUsersForQuery }
}

async function getIdsOfUsersNotToShow(currentUserId: string): Promise<string[]> {
    const rejectedUsersQuery = {
        $or: [
            { rejectedUserId: { $in: [currentUserId] } },
            { rejectorUserId: { $in: [currentUserId] } }
        ]
    }
    const rejectedUsersThatCurrentUserIsInResult = await getRejectedUsers(rejectedUsersQuery)
    const allUserChatsResult = await getAllUserChats(currentUserId);
    let allRecipientsOfChats: string[] = (Array.isArray(allUserChatsResult.data) && allUserChatsResult.data.length) ? (allUserChatsResult.data as string[]) : [];

    console.log('allRecipientsOfChats: ', allRecipientsOfChats)

    if (!allUserChatsResult.wasSuccessful) {
        console.error("Failed to get the current user from the firebase database.")

        throw new Error("Failed to get the current user from the firebase database.")
    }

    if ((rejectedUsersThatCurrentUserIsInResult.status !== 200) || !(rejectedUsersThatCurrentUserIsInResult.data as RejectedUserInterface[]).length) {
        console.error('Failed to get the rejected users docs for the current user.')
        console.log('The current user either has not been rejected or has not rejected any users.')
    }

    const allRejectedUserIds = [
        ...new Set((rejectedUsersThatCurrentUserIsInResult.data as RejectedUserInterface[])
            .flatMap((rejectedUserInfo: RejectedUserInterface) => {
                return [rejectedUserInfo.rejectedUserId, rejectedUserInfo.rejectorUserId]
            })
            .filter(userId => currentUserId !== userId))
    ]

    return [...allRejectedUserIds, ...allRecipientsOfChats]
}

// create a function that will get the current user 

async function getMatches(userQueryOpts: UserQueryOpts, currentUser: UserBaseModelSchema, allUnshowableUserIds: string[],currentPotentialMatches: UserBaseModelSchema[] = []): Promise<GetMatchesResult> {
    try {
        const potentialMatchesPaginationObj = await queryForPotentialMatches(userQueryOpts, currentUser, allUnshowableUserIds, currentPotentialMatches);

        return { status: 200, data: { ...potentialMatchesPaginationObj } }
    } catch (error) {
        console.error('An error has occurred in getting matches: ', error)
        const errMsg = `An error has occurred in getting matches for user: ${error}`

        return { status: 500, msg: errMsg }
    }
}

export { getMatches }


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
