import { Router, Request, Response } from 'express'
import GLOBAL_VALS from '../../globalVals.js';
import { createQueryOptsForPagination, getIdsOfUsersNotToShow, getMatches, getPromptsAndMatchingPicForClient } from '../../services/matching/matchesQueryServices.js';
import { ReqQueryMatchesParams, UserQueryOpts } from '../../types-and-interfaces/interfaces/userQueryInterfaces.js';
import { filterUsersWithoutPrompts, getPromptsImgUrlsAndUserInfo, getPromptsAndPicUrlsOfUsersAfterPicUrlOrPromptsRetrievalHasFailed, getUsersWithPrompts } from '../../services/matching/userMatchesInfoRetrievalServices.js';
import { IFilterUserWithoutPromptsReturnVal, IUserMatch, InterfacePotentialMatchesPage, MatchesQueryPage, PotentialMatchesPageMap, PotentialMatchesPaginationForClient } from '../../types-and-interfaces/interfaces/matchesQueryInterfaces.js';
import { UserBaseModelSchema } from '../../models/User.js';
import { ReturnTypeQueryForMatchesFn } from '../../types-and-interfaces/types/userQueryTypes.js';
import { IUserAndPrompts } from '../../types-and-interfaces/interfaces/promptsInterfaces.js';
import { User } from 'aws-sdk/clients/budgets.js';
import { MatchesQueryResponseBody, MatchesQueryRespsonseBodyBuild } from '../../types-and-interfaces/interfaces/responses/getMatches.js';
import { getAllUserChats } from '../../services/firebaseServices/firebaseDbServices.js';
import { getRejectedUsers } from '../../services/rejectingUsers/rejectedUsersService.js';
import { get } from 'http';
import { RejectedUserInterface } from '../../types-and-interfaces/interfaces/rejectedUserDocsInterfaces.js';
import { getUserById } from '../../services/globalMongoDbServices.js';
import { getPrompstByUserIds, filterInUsersWithPrompts } from '../../services/promptsServices/getPromptsServices.js';
import { IMatchingPicUser, filterInUsersWithValidMatchingPicUrl } from '../../services/matching/helper-fns/aws.js';

export const getMatchesRoute = Router();

interface QueryValidationInterface {
    correctVal: string | string[],
    isCorrectValType: boolean,
    fieldName: string,
    val: unknown,
    receivedType: string,
    receivedTypeInArr?: string[],
    recievedTypeOfValsInArr?: ({ fieldName: string, receivedType: string } | string)[]
}

interface RequestQuery extends Omit<UserQueryOpts, 'userLocation' | 'radiusInMilesInt' | 'skipDocsNum'> {
    userLocation: { latitude: string, longitude: string }
    radiusInMilesInt: string
    skipDocsNum: string
}


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

interface IGetValidMatchesReturnVal {
    hasReachedPaginationEnd: boolean,
    validMatches: UserBaseModelSchema[] | [],
    updatedSkipDocsNum: number,
    canStillQueryCurrentPageForUsers: boolean,
    didErrorOccur?: boolean
}
type TResponseBodyGetMatches = Omit<IGetValidMatchesReturnVal, 'validMatches'>
interface IResponseBodyGetMatches extends TResponseBodyGetMatches {
    validMatches?: IMatchingPicUser[]
}

async function getValidMatches(userQueryOpts: UserQueryOpts, currentUserId: string, validUserMatches: UserBaseModelSchema[]): Promise<IGetValidMatchesReturnVal> {
    const usersToRetrieveNum = 5 - validUserMatches.length;
    const allUserChatsResult = await getAllUserChats(currentUserId);
    const rejectedUsersQuery = {
        $or: [
            { rejectedUserId: { $in: [currentUserId] } },
            { rejectorUserId: { $in: [currentUserId] } }
        ]
    }
    const rejectedUsersThatCurrentUserIsInResult = await getRejectedUsers(rejectedUsersQuery)
    const rejectedUsers = (rejectedUsersThatCurrentUserIsInResult.data as RejectedUserInterface[])?.length ? (rejectedUsersThatCurrentUserIsInResult.data as RejectedUserInterface[]) : [];
    const allChatUsers = (allUserChatsResult.data as string[])?.length ? (allUserChatsResult.data as string[]) : [];
    const idsOfUsersNotToShow = await getIdsOfUsersNotToShow(currentUserId, rejectedUsers, allChatUsers);
    const currentUser = await getUserById(currentUserId);

    if (!currentUser) {
        console.error('Could not find current user in the db.');

        return { hasReachedPaginationEnd: true, validMatches: validUserMatches, updatedSkipDocsNum: userQueryOpts.skipDocsNum as number, canStillQueryCurrentPageForUsers: false, didErrorOccur: true };
    }

    const queryOptsForPagination = createQueryOptsForPagination(userQueryOpts, currentUser, idsOfUsersNotToShow)
    const queryMatchesResults = await getMatches(queryOptsForPagination, userQueryOpts.skipDocsNum as number);
    const { hasReachedPaginationEnd, potentialMatches, updatedSkipDocsNum, canStillQueryCurrentPageForUsers } = queryMatchesResults.data as InterfacePotentialMatchesPage;

    console.log('getMatches, potentialMatches array: ', potentialMatches)

    if (queryMatchesResults.status !== 200) {

        return { hasReachedPaginationEnd: true, validMatches: validUserMatches, updatedSkipDocsNum: userQueryOpts.skipDocsNum as number, canStillQueryCurrentPageForUsers: false, didErrorOccur: true };
    }

    if (potentialMatches === undefined) {
        console.log('Potential matches: ', potentialMatches);

        return { hasReachedPaginationEnd: true, validMatches: validUserMatches, updatedSkipDocsNum: userQueryOpts.skipDocsNum as number, canStillQueryCurrentPageForUsers: false, didErrorOccur: true };
    }

    let matchesToSendToClient = await filterInUsersWithValidMatchingPicUrl(potentialMatches)
    matchesToSendToClient = matchesToSendToClient?.length ? await filterInUsersWithPrompts(matchesToSendToClient) : [];
    matchesToSendToClient = matchesToSendToClient?.length ? matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum).slice(0, usersToRetrieveNum) : [];
    matchesToSendToClient = [...matchesToSendToClient, ...validUserMatches].sort((userA, userB) => userB.ratingNum - userA.ratingNum)
    const _updatedSkipDocsNum = typeof updatedSkipDocsNum === 'string' ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;
    let getValidMatchesResult: IGetValidMatchesReturnVal = { hasReachedPaginationEnd, validMatches: potentialMatches, updatedSkipDocsNum: _updatedSkipDocsNum, canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers }

    // BRAIN DUMP:
    // get the first 50 users
    // for the first 50 users, do the following:
    // get the amount of users that have imgage 3 as their matching pic, those users will be unshowable
    // the rest of the users will have their prompts deleted from the db
    // the target users of the page will be the three users of the sixth page. For the sixth page, get the users
    // that has the 3rd image as their matching pic
    // get users from the seventh page, and add them to page that will be present to the user on the client side.
    // check what is being received for the getMatches function  
    
    // GOAL #1: the target users of the page is retrieved and sent to the client.

    // GOAL #2: get the users of the sixth and seventh page 
    
    // GOAL #3: get the users of the first 5 pages. These users will have their prompts delete from the db or have their matching pic url deleted from aws if their 
    // matching pic is test-img-3.

    if (!hasReachedPaginationEnd && (matchesToSendToClient.length < 5)) {
        console.log('At least one user does not have a valid matching pic url or prompts. Getting new users.')
        const _skipDocsNum = (typeof userQueryOpts.skipDocsNum === 'string') ? parseInt(userQueryOpts.skipDocsNum) : userQueryOpts.skipDocsNum;
        const _userQueryOpts = { ...userQueryOpts, skipDocsNum: _skipDocsNum + 5 };
        getValidMatchesResult = await getValidMatches(_userQueryOpts, currentUserId, matchesToSendToClient) as IGetValidMatchesReturnVal;
    }

    return getValidMatchesResult;
}

getMatchesRoute.get(`/${GLOBAL_VALS.matchesRootPath}/get-matches`, async (request: Request, response: Response) => {
    console.time('getMatchesRoute')
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

    // change the values in userLocation into a number, assuming they are string since they are stored in the params of the request.
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

    const allUserChatsResult = await getAllUserChats(currentUserId);
    const rejectedUsersQuery = {
        $or: [
            { rejectedUserId: { $in: [currentUserId] } },
            { rejectorUserId: { $in: [currentUserId] } }
        ]
    }
    const rejectedUsersThatCurrentUserIsInResult = await getRejectedUsers(rejectedUsersQuery)
    const rejectedUsers = (rejectedUsersThatCurrentUserIsInResult.data as RejectedUserInterface[])?.length ? (rejectedUsersThatCurrentUserIsInResult.data as RejectedUserInterface[]) : [];
    const allChatUsers = (allUserChatsResult.data as string[])?.length ? (allUserChatsResult.data as string[]) : [];
    const idsOfUsersNotToShow = await getIdsOfUsersNotToShow(currentUserId, rejectedUsers, allChatUsers);
    const currentUser = await getUserById(currentUserId);

    if (!currentUser) {
        console.error('Could not find current user in the db.');

        return response.status(404).json({ msg: 'Could not find current user in the db.' })
    }

    const queryOptsForPagination = createQueryOptsForPagination(userQueryOpts, currentUser, idsOfUsersNotToShow)
    const queryMatchesResults = await getMatches(queryOptsForPagination, paginationPageNumUpdated);
    const { hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, potentialMatches, updatedSkipDocsNum } = queryMatchesResults.data as InterfacePotentialMatchesPage;
    const _updateSkipDocsNum = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;

    if (queryMatchesResults.status !== 200) {
        return response.status(queryMatchesResults.status).json({ msg: queryMatchesResults.msg })
    }

    if (potentialMatches === undefined) {
        console.log('Potential matches: ', potentialMatches)

        return response.status(500).json({ msg: "Failed to get potential matches." })
    }

    let matchesToSendToClient: UserBaseModelSchema[] | IUserAndPrompts[] = await filterInUsersWithValidMatchingPicUrl(potentialMatches) as UserBaseModelSchema[];
    matchesToSendToClient = matchesToSendToClient?.length ? await filterInUsersWithPrompts(matchesToSendToClient) : [];
    let paginationMatchesObj: IResponseBodyGetMatches = {
        hasReachedPaginationEnd: hasReachedPaginationEnd,
        updatedSkipDocsNum: _updateSkipDocsNum,
        canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers,
    }

    console.log("hasReachedPaginationEnd: ", hasReachedPaginationEnd)
    console.log("matchesToSendToClient: ", matchesToSendToClient)

    if (!hasReachedPaginationEnd && (matchesToSendToClient.length < 5)) {
        console.log("Some users either don't have prompts or a matching pic. Getting new users.")
        const getValidMatchesResult = await getValidMatches(userQueryOpts, currentUserId, matchesToSendToClient);
        console.log("getValidMatchesResult: ", getValidMatchesResult)
        matchesToSendToClient = getValidMatchesResult.validMatches;
    }

    const matchesToSendToClientUpdated: IUserMatch[] = matchesToSendToClient.map((user: unknown) => {
        const _user = (user as UserBaseModelSchema);

        return { ..._user, firstName: _user.name.first } as IUserMatch
    })

    console.log("matchesToSendToClientUpdated: ", matchesToSendToClientUpdated)

    const promptsAndMatchingPicForClientResult = await getPromptsAndMatchingPicForClient(matchesToSendToClientUpdated);

    console.log("promptsAndMatchingPicForClientResult: ", promptsAndMatchingPicForClientResult)

    if (!promptsAndMatchingPicForClientResult.wasSuccessful) {
        return response.status(500).json({ msg: promptsAndMatchingPicForClientResult.msg })
    }

    paginationMatchesObj.validMatches = promptsAndMatchingPicForClientResult.data

    return response.status(200).json({ paginationMatches: paginationMatchesObj })
})
