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
import GLOBAL_VALS from '../../globalVals.js';

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

    // GOAL #1:
    // get the cache here 
    // check if the current user who made request, check if there are users that can be queried first by their ids 
    // there are ids of the users that needs to be queried first stored in the cache
    // these users are not part of the idsOfUsersNotToShow
    // all of the above are true 
    // they queried from the database

    // GOAL #2:
    // for get matches, get the rest of the users

    // put the below into a function 
    const userIdsOfMatchesToShowForMatchesPg = cache.get("userIdsOfMatchesToShowForMatchesPg") as ICacheKeyVals;
    console.log("userIdsOfMatchesToShowForMatchesPg?.[currentUserId]: ", userIdsOfMatchesToShowForMatchesPg?.[currentUserId])
    let savedUserIdsOfMatches = userIdsOfMatchesToShowForMatchesPg?.[currentUserId] ?? [];
    savedUserIdsOfMatches = savedUserIdsOfMatches?.length ? savedUserIdsOfMatches.filter(userId => !idsOfUsersNotToShow.includes(userId)) : []
    let startingMatches: UserBaseModelSchema[] | null = null;
    let limitNum;

    console.log("savedUserIdsOfMatches.length: ", savedUserIdsOfMatches.length)

    if (savedUserIdsOfMatches.length) {
        limitNum = 5;
        console.log('Getting users from db based on users saved in the cache.')
        const savedUsersInCache = await getUsersByIds(savedUserIdsOfMatches);
        console.log("savedUsersInCache: ", savedUsersInCache)
        startingMatches = savedUsersInCache?.length ? savedUsersInCache : [];
        limitNum = limitNum - savedUserIdsOfMatches.length;
        cache.set("userIdsOfMatchesToShowForMatchesPg", { [currentUserId]: [] })
    }
    // put the above into a function

    const queryOptsForPagination = createQueryOptsForPagination(userQueryOpts, currentUser, idsOfUsersNotToShow)
    const queryMatchesResults = await getMatches(queryOptsForPagination, limitNum);
    let { hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, potentialMatches } = queryMatchesResults.data as InterfacePotentialMatchesPage;

    if (potentialMatches?.length && startingMatches?.length) {
        potentialMatches = [...startingMatches, ...potentialMatches]
    }

    console.log("potentialMatches: ", potentialMatches)

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

    const _updateSkipDocsNum = (typeof userQueryOpts.skipDocsNum === 'string') ? parseInt(userQueryOpts.skipDocsNum) : userQueryOpts.skipDocsNum;

    if (queryMatchesResults.status !== 200) {
        return response.status(queryMatchesResults.status).json({ msg: queryMatchesResults.msg })
    }

    if (potentialMatches === undefined) {
        console.log('Potential matches: ', potentialMatches)
        return response.status(500).json({ msg: "Failed to get potential matches." })
    }

    let matchesToSendToClient: UserBaseModelSchema[] | IUserAndPrompts[] = await filterInUsersWithValidMatchingPicUrl(potentialMatches) as UserBaseModelSchema[];
    matchesToSendToClient = matchesToSendToClient?.length ? await filterInUsersWithPrompts(matchesToSendToClient) : [];
    console.log("_updateSkipDocsNum: ", _updateSkipDocsNum)
    let paginationMatchesObj: IResponseBodyGetMatches = {
        hasReachedPaginationEnd: hasReachedPaginationEnd,
        updatedSkipDocsNum: _updateSkipDocsNum,
        canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers,
    }

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

    response.status(200).json({ paginationMatches: paginationMatchesObj })
    console.timeEnd('getMatchesRoute, timing.')
})
