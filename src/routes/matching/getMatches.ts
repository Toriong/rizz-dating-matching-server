import { Router, Request, Response } from 'express'
import { createQueryOptsForPagination, getIdsOfUsersNotToShow, getLocationStrForUsers, getMatches, getPromptsAndMatchingPicForClient, getValidMatches } from '../../services/matching/matchesQueryServices.js';
import { QueryValidationInterface, ReqQueryMatchesParams, UserQueryOpts } from '../../types-and-interfaces/interfaces/userQueryInterfaces.js';
import { UserBaseModelSchema } from '../../models/User.js';
import { IUserAndPrompts } from '../../types-and-interfaces/interfaces/promptsInterfaces.js';
import { getAllUserChats } from '../../services/firebaseServices/firebaseDbServices.js';
import { generateGetRejectedUsersQuery, getRejectedUsers } from '../../services/rejectingUsers/rejectedUsersService.js';
import { RejectedUserInterface } from '../../types-and-interfaces/interfaces/rejectedUserDocsInterfaces.js';
import { getUserById, getUsersByIds } from '../../services/globalMongoDbServices.js';
import { filterInUsersWithPrompts } from '../../services/promptsServices/getPromptsServices.js';
import { IMatchingPicUser, filterInUsersWithValidMatchingPicUrl } from '../../services/matching/helper-fns/aws.js';
import { IMatchesPagination, IUserMatch, InterfacePotentialMatchesPage } from '../../types-and-interfaces/interfaces/matchesQueryInterfaces.js';
import { IResponseBodyGetMatches } from '../../types-and-interfaces/interfaces/responses/getMatches.js';
import { ICacheKeyVals } from '../../types-and-interfaces/interfaces/cacheInterfaces.js';
import { RequestQuery } from '../../types-and-interfaces/interfaces/requests/getMatchesReqQuery.js';
import cache from '../../utils/cache.js';
import { GLOBAL_VALS, EXPIRATION_TIME_CACHED_MATCHES } from '../../globalVals.js';
import { DynamicKeyVal } from '../../types-and-interfaces/interfaces/globalInterfaces.js';

export const getMatchesRoute = Router();

function validateFormOfObj(key: string, obj: any): { fieldName: string, receivedType: string } {
    const receivedType = typeof obj[key];

    return { fieldName: key, receivedType: receivedType }
}

function getQueryOptionsValidationArr(queryOpts: UserQueryOpts): QueryValidationInterface[] {
    const { userLocation, desiredAgeRange, skipDocsNum, minAndMaxDistanceArr, isRadiusSetToAnywhere } = queryOpts ?? {}
    const [latitude, longitude] = userLocation ?? [];
    let areValsInMinAndMaxQueryDistanceArrValid = false
    let minAndMaxDistanceQueryArrValidationObj: QueryValidationInterface | null = null
    let areValsInDesiredAgeRangeArrValid = false;
    let areDesiredAgeRangeValsValidObj: QueryValidationInterface | null = null;
    let isLongAndLatValueTypeValid = false;
    let areLongAndLatValid: QueryValidationInterface | null = null;

    if (!isRadiusSetToAnywhere) {
        areValsInMinAndMaxQueryDistanceArrValid = (Array.isArray(desiredAgeRange) && (desiredAgeRange.length === 2)) && desiredAgeRange.every(date => !Number.isNaN(Date.parse(date)));
        minAndMaxDistanceQueryArrValidationObj = {
            receivedType: typeof minAndMaxDistanceArr,
            correctVal: 'number',
            fieldName: 'radiusInMilesInt',
            val: minAndMaxDistanceArr,
            isCorrectValType: areValsInMinAndMaxQueryDistanceArrValid
        }
        areValsInDesiredAgeRangeArrValid = (Array.isArray(desiredAgeRange) && (desiredAgeRange.length === 2)) && desiredAgeRange.every(date => !Number.isNaN(Date.parse(date)));
        areDesiredAgeRangeValsValidObj = {
            receivedType: typeof desiredAgeRange,
            recievedTypeOfValsInArr: desiredAgeRange.map(ageDate => typeof ageDate),
            correctVal: 'object',
            fieldName: 'desiredAgeRange',
            isCorrectValType: areValsInDesiredAgeRangeArrValid, val: desiredAgeRange
        }
        isLongAndLatValueTypeValid = (!!longitude && !!latitude) && ((typeof longitude === 'string') && (typeof latitude === 'string')) && ((typeof parseFloat(longitude as string) === 'number') && (typeof parseFloat(latitude as string) === 'number'))
        areLongAndLatValid = {
            receivedType: typeof userLocation,
            recievedTypeOfValsInArr: Object.keys(userLocation).map(key => validateFormOfObj(key, userLocation)),
            correctVal: 'number',
            fieldName: 'userLocation',
            isCorrectValType: isLongAndLatValueTypeValid,
            val: userLocation,
        }
    }

    const paginationPageNumValidationObj = { receivedType: typeof skipDocsNum, correctVal: 'number', fieldName: 'skipDocsNum', isCorrectValType: typeof parseInt(skipDocsNum as string) === 'number', val: skipDocsNum }
    let defaultValidationKeyValsArr = [paginationPageNumValidationObj]

    if (!isRadiusSetToAnywhere && minAndMaxDistanceQueryArrValidationObj && areDesiredAgeRangeValsValidObj && areLongAndLatValid) {
        return [...defaultValidationKeyValsArr, minAndMaxDistanceQueryArrValidationObj, areDesiredAgeRangeValsValidObj, areLongAndLatValid];
    }


    const isRadiusSetToAnywhereValidtionObj = { receivedType: typeof isRadiusSetToAnywhere, correctVal: 'boolean', fieldName: 'isRadiusSetToAnywhere', isCorrectValType: typeof Boolean(isRadiusSetToAnywhere) === 'boolean', val: isRadiusSetToAnywhere }

    return [...defaultValidationKeyValsArr, isRadiusSetToAnywhereValidtionObj]
}


function generateMatchesPg(matchesPaginationObj: IMatchesPagination): IMatchesPagination {
    const { canStillQueryCurrentPageForUsers, hasReachedPaginationEnd, validMatches, updatedSkipDocsNum, didErrorOccur, didTimeOutOccur } = matchesPaginationObj ?? {};
    return {
        hasReachedPaginationEnd: !!hasReachedPaginationEnd,
        validMatches: validMatches,
        updatedSkipDocsNum: updatedSkipDocsNum,
        canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers,
        didErrorOccur: !!didErrorOccur,
        didTimeOutOccur: !!didTimeOutOccur
    };
}


// BUG: 
// WHAT IS HAPPENING: when the time out is completed, the updated skip nums value is not being updated. It is still zero when the time out has reached. 
// updated skip docs num is not being updated

// brain dump:
// for silver and bronze:
// for bronze: the user can only have 15 matches in a span 48 hour period
// for silver: the user can only have 25 matches in a span 48 hour period



getMatchesRoute.get(`/${GLOBAL_VALS.matchesRootPath}/get-matches`, async (request: Request, response: Response) => {
    console.time('getMatchesRoute, timing.')
    let query: unknown | ReqQueryMatchesParams = request.query

    if (!query || !(query as ReqQueryMatchesParams)?.query || !(query as ReqQueryMatchesParams).userId) {
        return response.status(400).json({ msg: 'Missing query parameters.' })
    }

    let userQueryOpts: RequestQuery | UserQueryOpts = (query as ReqQueryMatchesParams).query;
    const currentUserId = (query as ReqQueryMatchesParams).userId;
    const queryOptsValidArr = getQueryOptionsValidationArr(userQueryOpts);
    const areQueryOptsValid = queryOptsValidArr.every(queryValidationObj => queryValidationObj.isCorrectValType)

    if (!areQueryOptsValid) {
        const invalidQueryOpts = queryOptsValidArr.filter(({ isCorrectValType }) => !isCorrectValType)

        console.table(invalidQueryOpts)

        console.error('An errror has occurred. Invalid query parameters.')

        return response.status(400).json({ msg: 'Invalid query parameters.' })
    }

    console.log("Will get the user's matches and send them to the client.")

    const { userLocation, skipDocsNum, minAndMaxDistanceArr } = userQueryOpts as UserQueryOpts;
    const paginationPageNumUpdated = parseInt(skipDocsNum as string)

    if (minAndMaxDistanceArr?.length && userLocation?.length) {
        const _userLocation = ([userLocation[0], userLocation[1]] as [string, string]).map(val => parseFloat(val))
        const _minAndMaxDistanceArrUpdated = minAndMaxDistanceArr.map(val => parseInt(val as string))
        userQueryOpts = { ...userQueryOpts, skipDocsNum: paginationPageNumUpdated, userLocation: _userLocation, minAndMaxDistanceArr: _minAndMaxDistanceArrUpdated } as UserQueryOpts;
    }


    if (userQueryOpts?.isRadiusSetToAnywhere && (Boolean(userQueryOpts.isRadiusSetToAnywhere) && (userQueryOpts.isRadiusSetToAnywhere === 'true'))) {
        userQueryOpts = { ...userQueryOpts, skipDocsNum: paginationPageNumUpdated, isRadiusSetToAnywhere: true }
    }

    const rejectedUsersQuery = generateGetRejectedUsersQuery([currentUserId], true);
    const [allUserChatsResult, rejectedUsersThatCurrentUserIsInResult, currentUser] = await Promise.all([getAllUserChats(currentUserId), getRejectedUsers(rejectedUsersQuery), getUserById(currentUserId)])
    const rejectedUsers = (rejectedUsersThatCurrentUserIsInResult.data as RejectedUserInterface[])?.length ? (rejectedUsersThatCurrentUserIsInResult.data as RejectedUserInterface[]) : [];
    const allChatUsers = (allUserChatsResult.data as string[])?.length ? (allUserChatsResult.data as string[]) : [];
    const idsOfUsersNotToShow = getIdsOfUsersNotToShow(currentUserId, rejectedUsers, allChatUsers);

    if (!currentUser) {
        console.error('Could not find current user in the db.');
        return response.status(404).json({ msg: 'Could not find current user in the db.' })
    }

    // create a function that will query that cache, have the return type be unknown

    // function getItemFromCache(key: string): unknown {
    //     return cache.get(key)
    // }

    // create a function called getMatchesFromCache
    // END GOAL STEP: the id of the matches were received from the cache, and then returned from the function

    // put the below into a function 
    const userIdsOfMatchesToShowForMatchesPg = cache.get("userIdsOfMatchesToShowForMatchesPg") as ICacheKeyVals;
    console.log("userIdsOfMatchesToShowForMatchesPg?.[currentUserId]: ", userIdsOfMatchesToShowForMatchesPg?.[currentUserId])
    let savedUserIdsOfMatches = userIdsOfMatchesToShowForMatchesPg?.[currentUserId] ?? [];
    savedUserIdsOfMatches = savedUserIdsOfMatches?.length ? savedUserIdsOfMatches.filter(userId => !idsOfUsersNotToShow.includes(userId)) : []
    let startingMatches: UserBaseModelSchema[] | null = null;

    console.log("savedUserIdsOfMatches.length: ", savedUserIdsOfMatches.length)

    // the id of the user that was received from the last test run: 01H2S38E7NMK4RAGQPTCYJSE1S
    if (savedUserIdsOfMatches.length) {
        console.log('Getting users from db based on users saved in the cache.')
        const savedUsersInCache = await getUsersByIds(savedUserIdsOfMatches);
        console.log("savedUsersInCache: ", savedUsersInCache)
        startingMatches = savedUsersInCache?.length ? savedUsersInCache : [];
        cache.set("userIdsOfMatchesToShowForMatchesPg", { [currentUserId]: [] })
    }
    // put the above into a function

    const queryOptsForPagination = createQueryOptsForPagination(userQueryOpts, currentUser, idsOfUsersNotToShow)
    const queryMatchesResults = await getMatches(queryOptsForPagination);
    let { hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, potentialMatches } = queryMatchesResults.data as InterfacePotentialMatchesPage;

    if (potentialMatches?.length && startingMatches?.length) {
        potentialMatches = [...startingMatches, ...potentialMatches]
    }
    // BRAIN DUMP NOTES:
    // not getting the correct users from the cache,
    // check what user ids are being received from the cache and then queried to the database 

    console.log("potentialMatches: ", potentialMatches)
    console.log('potentialMatches.length: ', potentialMatches?.length)

    // FOR TESTING PURPOSES, BELOW:

    // let _potentialMatches = potentialMatches as UserBaseModelSchema[];
    // const usersOfPromptsToDelete = _potentialMatches?.filter(({ pics }) => {
    //     const matchingPic = pics.find(({ isMatching }) => isMatching);

    //     return (matchingPic?.picFileNameOnAws !== 'test-img-3.jpg');
    // })
    // const potentialMatchesWithTestImg3 = _potentialMatches?.filter(({ pics }) => {
    //     const matchingPic = pics.find(({ isMatching }) => isMatching);

    //     return (matchingPic?.picFileNameOnAws === 'test-img-3.jpg');
    // })
    // const userIdsOfPromptsToDelete = usersOfPromptsToDelete.map(({ _id, ratingNum }) => ({ _id, ratingNum }))
    // const potentialMatchesWithTestImg3UserIds = potentialMatchesWithTestImg3.map(({ _id }) => _id)
    // const totalUsersQueried = userIdsOfPromptsToDelete.length + potentialMatchesWithTestImg3UserIds.length

    // const userIdsAndRatingNum = _potentialMatches.map(({ _id, ratingNum }) => ({ _id, ratingNum }))
    // console.log('userIdsAndRatingNum: ', userIdsAndRatingNum)
    // console.log('totalUsersQueried: ', totalUsersQueried)
    // console.log('userIdsOfPromptsToDelete: ', userIdsOfPromptsToDelete)
    // console.log('potentialMatchesWithTestImg3UserIds: ', potentialMatchesWithTestImg3UserIds)


    // response.status(200).json({ msg: "Users received!" })

    // FOR TESTING PURPOSES, ABOVE:

    const _updateSkipDocsNum = (typeof userQueryOpts?.skipDocsNum === 'string') ? parseInt(userQueryOpts.skipDocsNum) : userQueryOpts.skipDocsNum;

    if (queryMatchesResults.status !== 200) {
        return response.status(queryMatchesResults.status).json({ msg: queryMatchesResults.msg })
    }

    if (potentialMatches === undefined) {
        console.log('Potential matches: ', potentialMatches)
        return response.status(500).json({ msg: "Failed to get potential matches." })
    }

    let matchesToSendToClient: UserBaseModelSchema[] | IUserAndPrompts[] = await filterInUsersWithValidMatchingPicUrl(potentialMatches) as UserBaseModelSchema[];
    matchesToSendToClient = matchesToSendToClient?.length ? await filterInUsersWithPrompts(matchesToSendToClient) : [];
    matchesToSendToClient = matchesToSendToClient?.length ? matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum) : [];

    // after the validations of the users that were attained from the cache and database has been executed, get only five of the highest rated users
    // for the rest, save them into the cache

    const areSavedUsersInCacheValid = (savedUserIdsOfMatches?.length && matchesToSendToClient?.length) ? matchesToSendToClient.some(({ _id }) => savedUserIdsOfMatches.includes(_id)) : false;

    if (areSavedUsersInCacheValid && (matchesToSendToClient.length > 5)) {
        console.log('Adding users who were saved in the cache first to the array that will be sent to the client.')
        let usersToSendToClientUpdated = matchesToSendToClient.filter(({ _id }) => savedUserIdsOfMatches.includes(_id));
        console.log('usersToSendToClientUpdated: ', usersToSendToClientUpdated)
        let usersNotSavedInCache = matchesToSendToClient.filter(({ _id }) => !savedUserIdsOfMatches.includes(_id));
        console.log('usersNotSavedInCache: ', usersNotSavedInCache)
        let userIdsToSaveIntoCache: string[] = [];

        if (usersNotSavedInCache.length !== 0) {
            for (let numIteration = 0; usersNotSavedInCache.length < 5; numIteration++) {
                if (usersToSendToClientUpdated.length === 5) {
                    userIdsToSaveIntoCache = usersNotSavedInCache.slice(numIteration).map(({ _id }) => _id);
                    break;
                }

                usersToSendToClientUpdated.push(usersNotSavedInCache[numIteration]);
            }
        }

        matchesToSendToClient = usersToSendToClientUpdated

        if (matchesToSendToClient?.length > 5) {
            const matchesUserIdsToCache = matchesToSendToClient.slice(5).map(({ _id }) => _id);
            userIdsToSaveIntoCache = userIdsToSaveIntoCache?.length ? [...userIdsToSaveIntoCache, ...matchesUserIdsToCache] : matchesUserIdsToCache;
            matchesToSendToClient = matchesToSendToClient.slice(0, 5);
        }


        if (userIdsToSaveIntoCache?.length) {
            const userIdsOfMatchesToShowForMatchesPg = cache.get("userIdsOfMatchesToShowForMatchesPg");
            let matchesUserIdsForCurrentUsers = (userIdsOfMatchesToShowForMatchesPg as DynamicKeyVal<string[]>)?.[currentUserId] ?? [];
            matchesUserIdsForCurrentUsers = [...matchesUserIdsForCurrentUsers, ...userIdsToSaveIntoCache]
            cache.set("userIdsOfMatchesToShowForMatchesPg", { [currentUserId]: matchesUserIdsForCurrentUsers }, EXPIRATION_TIME_CACHED_MATCHES)
        }
    }

    let paginationMatchesObj: IResponseBodyGetMatches = {
        hasReachedPaginationEnd: hasReachedPaginationEnd,
        updatedSkipDocsNum: _updateSkipDocsNum,
        canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers,
    }

    // CASE: at least one of the user don't have a valid matching pic url or prompts and there is at least one user saved in the cache

    if (!hasReachedPaginationEnd && (matchesToSendToClient?.length < 5)) {
        const _skipDocsNum = !!canStillQueryCurrentPageForUsers ? _updateSkipDocsNum : (_updateSkipDocsNum as number) + 5;
        const _userQueryOpts = { ...userQueryOpts, skipDocsNum: _skipDocsNum } as UserQueryOpts;
        console.time("Getting matches again timing.")
        const getValidMatchesResult = await getValidMatches(_userQueryOpts, currentUser, matchesToSendToClient, idsOfUsersNotToShow);
        console.timeEnd("Getting matches again timing.")
        const { didTimeOutOccur, didErrorOccur, updatedSkipDocsNum, validMatches, canStillQueryCurrentPageForUsers: canStillQueryCurrentPageForUsersValidMatches, hasReachedPaginationEnd } = (getValidMatchesResult.page as IMatchesPagination) ?? {};
        paginationMatchesObj.didTimeOutOccur = didTimeOutOccur ?? false;
        paginationMatchesObj.updatedSkipDocsNum = updatedSkipDocsNum;
        paginationMatchesObj.canStillQueryCurrentPageForUsers = !!canStillQueryCurrentPageForUsersValidMatches;
        paginationMatchesObj.hasReachedPaginationEnd = hasReachedPaginationEnd;

        if (didErrorOccur) {
            return response.status(500).json({ msg: 'An error has occurred in getting the matches.' })
        }

        matchesToSendToClient = validMatches ?? [];
    }

    if (!matchesToSendToClient.length) {
        console.log('No matches to send to client.')
        paginationMatchesObj.potentialMatches = [];

        return response.status(200).json({ paginationMatches: paginationMatchesObj })
    }

    const matchesToSendToClientUpdated: IUserMatch[] = matchesToSendToClient.map((user: unknown) => {
        const _user = (user as UserBaseModelSchema);

        return { ..._user, firstName: _user.name.first } as unknown as IUserMatch;
    })
    const promptsAndMatchingPicForClientResult = await getPromptsAndMatchingPicForClient(matchesToSendToClientUpdated);

    if (!promptsAndMatchingPicForClientResult.wasSuccessful) {
        console.error('Something went wrong. Couldn\'t get prompts and matching pic for client.')
        return response.status(500).json({ msg: promptsAndMatchingPicForClientResult.msg })
    }

    let potentialMatchesForClient = promptsAndMatchingPicForClientResult.data;
    potentialMatchesForClient = await getLocationStrForUsers(potentialMatchesForClient as IMatchingPicUser[])
    paginationMatchesObj.potentialMatches = potentialMatchesForClient;

    console.log('paginationMatchesObj: ', paginationMatchesObj)
    console.log("paginationMatchesObj.potentialMatches ids: ", paginationMatchesObj.potentialMatches.map(({ _id }) => _id))

    response.status(200).json({ paginationMatches: paginationMatchesObj })
    console.timeEnd('getMatchesRoute, timing.')
})
