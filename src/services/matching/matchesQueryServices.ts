import mongoose from "mongoose";
import { User as Users, PaginatedModel, PaginationQueryingOpts, PaginationArgsOpts, ReturnTypeOfPaginateFn, UserBaseModelSchema, User } from "../../models/User.js"
import { UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";
import moment from "moment";
import { getUserById } from "../globalMongoDbServices.js";
import { getRejectedUsers } from "../rejectingUsers/rejectedUsersService.js";
import { getAllUserChats } from "../firebaseServices/firebaseDbServices.js";
import { RejectedUserInterface } from "../../types-and-interfaces/interfaces/rejectedUserDocsInterfaces.js";
import { InterfacePotentialMatchesPage } from "../../types-and-interfaces/interfaces/matchesQueryInterfaces.js";


interface GetMatchesResult {
    status: number,
    data?: InterfacePotentialMatchesPage,
    msg?: string
}

async function queryForPotentialMatches(userQueryOpts: UserQueryOpts, currentUser: UserBaseModelSchema, allUnshowableUserIds: string[], currentPotentialMatches: UserBaseModelSchema[] = []): Promise<InterfacePotentialMatchesPage> {
    // put the below into a funtion, call it: createQueryOptsForPagination
    const { userLocation, radiusInMilesInt, desiredAgeRange, skipDocsNum } = userQueryOpts;
    let updatedSkipDocsNum = skipDocsNum;
    console.log('skipDocsNum: ', skipDocsNum)
    const currentPageNum = (skipDocsNum as number) / 5;
    console.log('currentPageNum: ', currentPageNum)
    const METERS_IN_A_MILE = 1609.34;
    const [minAge, maxAge] = desiredAgeRange;
    const { latitude, longitude } = userLocation;
    const paginationQueryOpts: PaginationQueryingOpts = {
        // _id: { $nin: allUnshowableUserIds },
        location: {
            $near: {
                $geometry: { type: "Point", coordinates: [longitude as number, latitude as number] },
                $maxDistance: (radiusInMilesInt as number) * METERS_IN_A_MILE,
                // CONDITIONS: 
                // the user went through users based on x radius and there are no more users to show

                // GOAL: 
                // query for users based on the following conditions:
                // minDistance: x (the previous radius)
                // maxDistance: y (the new radius)
            }
        },
        sex: (currentUser.sex === 'Male') ? 'Female' : 'Male',
        hasPrompts: true,
        sexAttraction: currentUser.sexAttraction,
        birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
    }
    const pageOpts = { skip: skipDocsNum as number, limit: 5 };

    (Users as any).createIndexes([{ location: '2dsphere' }])

    const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count()
    const potentialMatchesPromise = Users.find(paginationQueryOpts, null, pageOpts).sort({ ratingNum: 'desc' }).lean()
    let [totalUsersForQuery, pageQueryUsers]: [number, UserBaseModelSchema[]] = await Promise.all([totalUsersForQueryPromise, potentialMatchesPromise])
    const hasReachedPaginationEnd = (5 * currentPageNum) >= totalUsersForQuery;

    if (totalUsersForQuery === 0) {
        return { potentialMatches: [], updatedSkipDocsNum: 0, canStillQueryCurrentPageForUsers: false, hasReachedPaginationEnd: true }
    }

    pageQueryUsers = pageQueryUsers.filter(({ _id }) => !allUnshowableUserIds.includes(_id))
    let potentialMatches = currentPotentialMatches;

    if (!pageQueryUsers.length && !hasReachedPaginationEnd) {
        console.log('no users were found for the current query.')
        const _userQueryOpts = { ...userQueryOpts, skipDocsNum: (((skipDocsNum as number) / 5) + 1) * 5 }
        const results = await queryForPotentialMatches(_userQueryOpts, currentUser, allUnshowableUserIds, potentialMatches)
        const { potentialMatches: updatedPotentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum } = results;
        potentialMatches = updatedPotentialMatches?.length ? updatedPotentialMatches : [];
        updatedSkipDocsNum = _updatedSkipDocsNum as number;
    }

    const sumBetweenPotentialMatchesAndPgQueryUsers = pageQueryUsers.length + potentialMatches.length

    if ((sumBetweenPotentialMatchesAndPgQueryUsers < 5) && (sumBetweenPotentialMatchesAndPgQueryUsers > 0)) {
        console.log('Not enough user to display to the user on the client side, querying for more users...')
        potentialMatches = [...potentialMatches, ...pageQueryUsers]
        const _userQueryOpts = { ...userQueryOpts, skipDocsNum: (((skipDocsNum as number) / 5) + 1) * 5 }
        const { potentialMatches: updatedPotentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum } = await queryForPotentialMatches(_userQueryOpts, currentUser, allUnshowableUserIds, potentialMatches)
        potentialMatches = updatedPotentialMatches?.length ? updatedPotentialMatches : [];
        updatedSkipDocsNum = _updatedSkipDocsNum as number;
    }

    let endingSliceNum = 5;

    if (sumBetweenPotentialMatchesAndPgQueryUsers > 0) {
        console.log('Getting users to add to the existing potential matches array.')
        endingSliceNum = 5 - potentialMatches.length
        const usersToAddToMatches = pageQueryUsers.sort((userA, userB) => userB.ratingNum - userA.ratingNum).slice(0, endingSliceNum)
        potentialMatches = [...potentialMatches, ...usersToAddToMatches].sort((userA, userB) => userB.ratingNum - userA.ratingNum)
    }

    console.log('Returning potential matches page info...')

    return { potentialMatches: potentialMatches, updatedSkipDocsNum, canStillQueryCurrentPageForUsers: endingSliceNum < 5, hasReachedPaginationEnd: (5 * currentPageNum) >= totalUsersForQuery }
}



async function getMatches(userQueryOpts: UserQueryOpts, currentUserId: string, currentPotentialMatches: UserBaseModelSchema[] = []): Promise<GetMatchesResult> {
    try {

        console.log('getMatches, currentUserId: ', currentUserId)

        const currentUser = await getUserById(currentUserId)

        console.log('currentUser: ', currentUser)

        if (!currentUser) {
            console.error('No user was attained from the database.')
            throw new Error('An error has occurred in getting the current user.')
        }

        // put the below into a function, call it: "getUsersNotToShow"
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
        const allUnshowableUserIds = [...allRejectedUserIds, ...allRecipientsOfChats]

        // FOR CHECKING WHAT USERS ARE ATTAINED BASED ON A SPECIFIC QUERY

        const { userLocation, radiusInMilesInt, desiredAgeRange, skipDocsNum, isRadiusSetToAnywhere } = userQueryOpts;
        let updatedSkipDocsNum = skipDocsNum;
        console.log('skipDocsNum: ', skipDocsNum)
        const currentPageNum = (skipDocsNum as number) / 5;
        console.log('currentPageNum: ', currentPageNum)
        const METERS_IN_A_MILE = 1609.34;
        const [minAge, maxAge] = desiredAgeRange;
        const { latitude, longitude } = userLocation;
        const paginationQueryOpts: PaginationQueryingOpts = {
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [longitude as number, latitude as number] },
                    $maxDistance: (radiusInMilesInt as number) * METERS_IN_A_MILE,
                }
            },
            sex: (currentUser.sex === 'Male') ? 'Female' : 'Male',
            hasPrompts: true,
            // sexAttraction: currentUser.sexAttraction,
            birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
        }
        // THE TEST WILL BE AS FOLLOWS:
        // get the first 50 users 
        // these users will be the users that has rejected the current user 
        
        // for the users on the sixth page, does users are valid. Those users will be displayed on the client-side. 
        const pageOpts = { skip: 0, limit: 50 };

        (Users as any).createIndexes([{ location: '2dsphere' }])

        const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count()
        const potentialMatchesPromise = Users.find(paginationQueryOpts, null, pageOpts).sort({ ratingNum: 'desc' }).lean()
        let [totalUsersForQuery, pageQueryUsers]: [number, UserBaseModelSchema[]] = await Promise.all([totalUsersForQueryPromise, potentialMatchesPromise])

        console.log('user ids: ')
        console.table(pageQueryUsers.map(({ _id }) => _id))

        return { status: 200, data: { potentialMatches: pageQueryUsers, updatedSkipDocsNum: 5, canStillQueryCurrentPageForUsers: true, hasReachedPaginationEnd: false } }

        // THE ABOVE IS FOR CHECKING WHAT USERS ARE ATTAINED BASED ON A SPECIFIC QUERY


        
        // const potentialMatchesPaginationObj = await queryForPotentialMatches(userQueryOpts, currentUser, allUnshowableUserIds, currentPotentialMatches);

        // return { status: 200, data: { ...potentialMatchesPaginationObj } }
    } catch (error) {
        console.error('An error has occurred in getting matches: ', error)
        const errMsg = `An error has occurred in getting matches for user: ${error}`

        return { status: 500, msg: errMsg }
    }
}

export { getMatches }
