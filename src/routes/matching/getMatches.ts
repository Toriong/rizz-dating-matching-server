import { Router, Request, Response } from 'express'
import { createQueryOptsForPagination, getIdsOfUsersNotToShow, getLocationStrForUsers, getMatches, getPromptsAndMatchingPicForClient } from '../../services/matching/matchesQueryServices.js';
import { ReqQueryMatchesParams, UserQueryOpts } from '../../types-and-interfaces/interfaces/userQueryInterfaces.js';
import { UserBaseModelSchema } from '../../models/User.js';
import { IUserAndPrompts } from '../../types-and-interfaces/interfaces/promptsInterfaces.js';
import { getAllUserChats } from '../../services/firebaseServices/firebaseDbServices.js';
import { generateGetRejectedUsersQuery, getRejectedUsers } from '../../services/rejectingUsers/rejectedUsersService.js';
import { RejectedUserInterface } from '../../types-and-interfaces/interfaces/rejectedUserDocsInterfaces.js';
import { getUserById } from '../../services/globalMongoDbServices.js';
import { filterInUsersWithPrompts } from '../../services/promptsServices/getPromptsServices.js';
import { IMatchingPicUser, filterInUsersWithValidMatchingPicUrl } from '../../services/matching/helper-fns/aws.js';
import { IUserMatch, InterfacePotentialMatchesPage } from '../../types-and-interfaces/interfaces/matchesQueryInterfaces.js';
import GLOBAL_VALS from '../../globalVals.js';
import { IError } from '../../types-and-interfaces/interfaces/globalInterfaces.js';

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

interface IMatchesPagination {
    hasReachedPaginationEnd: boolean,
    validMatches: UserBaseModelSchema[] | [],
    updatedSkipDocsNum: number,
    canStillQueryCurrentPageForUsers: boolean,
    didErrorOccur?: boolean
}
interface IGetValidMatches extends IError {
    page?: IMatchesPagination
    didTimeOut?: boolean
}
type TResponseBodyGetMatches = Omit<IMatchesPagination, 'validMatches'>
interface IResponseBodyGetMatches extends TResponseBodyGetMatches {
    potentialMatches?: IMatchingPicUser[]
}

function getIdAndPics(user: UserBaseModelSchema) {
    const pic = user.pics.find(({ isMatching }) => isMatching);

    return { pic, _id: user._id };
}

// move all outputs of functions that are n(1) as parameters for the getValidMatches function

async function getValidMatches(userQueryOpts: UserQueryOpts, currentUser: UserBaseModelSchema, currentValidUserMatches: UserBaseModelSchema[], idsOfUsersNotToShow: string[] = []): Promise<IGetValidMatches> {
    let validMatchesToSendToClient = [];
    let _userQueryOpts: UserQueryOpts = { ...userQueryOpts }
    let matchesPage = {} as IMatchesPagination;
    const usersToRetrieveNum = 5 - currentValidUserMatches.length;

    // if the below while loop take longer than 15 seconds, break it tell the client that the server is taking longer than usually to get the matches, the client can do the following: 
    // wait for the matches
    // start over their search for matches

    try {
        while (validMatchesToSendToClient.length < 5) {
            const queryOptsForPagination = createQueryOptsForPagination(_userQueryOpts, currentUser, idsOfUsersNotToShow)
            const queryMatchesResults = await getMatches(queryOptsForPagination, _userQueryOpts.skipDocsNum as number);
            const { hasReachedPaginationEnd, potentialMatches, updatedSkipDocsNum, canStillQueryCurrentPageForUsers } = queryMatchesResults.data as InterfacePotentialMatchesPage;

            if (queryMatchesResults.status !== 200) {
                matchesPage = {
                    hasReachedPaginationEnd: true,
                    validMatches: currentValidUserMatches,
                    updatedSkipDocsNum: _userQueryOpts.skipDocsNum as number,
                    canStillQueryCurrentPageForUsers: false,
                    didErrorOccur: true
                };
                break;
            }

            if (potentialMatches === undefined) {
                matchesPage = {
                    hasReachedPaginationEnd: true,
                    validMatches: currentValidUserMatches,
                    updatedSkipDocsNum: _userQueryOpts.skipDocsNum as number,
                    canStillQueryCurrentPageForUsers: false,
                    didErrorOccur: true
                };
                break;
            }

            let matchesToSendToClient = await filterInUsersWithValidMatchingPicUrl(potentialMatches)
            matchesToSendToClient = matchesToSendToClient.length ? await filterInUsersWithPrompts(matchesToSendToClient) : [];
            matchesToSendToClient = matchesToSendToClient.length ? matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum).slice(0, usersToRetrieveNum) : [];
            matchesToSendToClient = matchesToSendToClient.length ? [...matchesToSendToClient, ...currentValidUserMatches].sort((userA, userB) => userB.ratingNum - userA.ratingNum) : [];


            if (matchesToSendToClient.length) {
                validMatchesToSendToClient.push(...matchesToSendToClient)
            }

            let _updatedSkipDocsNum = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;

            if ((validMatchesToSendToClient.length < 5) && !hasReachedPaginationEnd) {
                _updatedSkipDocsNum = _updatedSkipDocsNum + 5;
                _userQueryOpts = { ..._userQueryOpts, skipDocsNum: _updatedSkipDocsNum }
            }

            if (hasReachedPaginationEnd || (validMatchesToSendToClient.length >= 5)) {
                matchesPage = {
                    hasReachedPaginationEnd,
                    validMatches: validMatchesToSendToClient,
                    updatedSkipDocsNum: _updatedSkipDocsNum,
                    canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers
                }

                if (hasReachedPaginationEnd) {
                    break;
                }
            }
        }

        return { page: matchesPage }
    } catch (error) {
        console.error('Failed to get valid matches. An error has occurred: ', error)

        return { didErrorOccur: true };
    }

}

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

    const queryOptsForPagination = createQueryOptsForPagination(userQueryOpts, currentUser, idsOfUsersNotToShow)
    const queryMatchesResults = await getMatches(queryOptsForPagination, paginationPageNumUpdated);

    // GOAL: get the ids of the first 100 users
    const { hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, potentialMatches, updatedSkipDocsNum } = queryMatchesResults.data as InterfacePotentialMatchesPage;

    // FOR TESTING PURPOSES, BELOW:
    let _potentialMatches = potentialMatches as UserBaseModelSchema[];
    const potentialMatchesWithNonTestImg3 = _potentialMatches?.filter(({ pics }) => {
        const matchingPic = pics.find(({ isMatching }) => isMatching);

        return matchingPic?.picFileNameOnAws !== 'test-img-3.jpg'
    })
    const potentialMatchesWithNonTestImg3Ids = potentialMatchesWithNonTestImg3?.map(({ _id }) => _id)
    const usersWithTestImg3 = potentialMatchesWithNonTestImg3.filter(({ _id }) => potentialMatchesWithNonTestImg3Ids.includes(_id))
    const usersWithTestImg3Num = _potentialMatches?.length as number - potentialMatchesWithNonTestImg3?.length as number;
    console.log("potentialMatchesWithNonTestImg3Ids: ", potentialMatchesWithNonTestImg3Ids);
    console.log("usersWithTestImg3 ids: ", usersWithTestImg3.map(({_id}) => _id));
    const totalUsersQueried = usersWithTestImg3Num + potentialMatchesWithNonTestImg3Ids?.length as number;
    console.log("totalUsersQueried: ", totalUsersQueried)
    // FOR TESTING PURPOSES, ABOVE:

    const _updateSkipDocsNum = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;

    return response.status(200);


    // if (queryMatchesResults.status !== 200) {
    //     return response.status(queryMatchesResults.status).json({ msg: queryMatchesResults.msg })
    // }

    // if (potentialMatches === undefined) {
    //     console.log('Potential matches: ', potentialMatches)
    //     return response.status(500).json({ msg: "Failed to get potential matches." })
    // }

    // let matchesToSendToClient: UserBaseModelSchema[] | IUserAndPrompts[] = await filterInUsersWithValidMatchingPicUrl(potentialMatches) as UserBaseModelSchema[];
    // matchesToSendToClient = matchesToSendToClient?.length ? await filterInUsersWithPrompts(matchesToSendToClient) : [];
    // let paginationMatchesObj: IResponseBodyGetMatches = {
    //     hasReachedPaginationEnd: hasReachedPaginationEnd,
    //     updatedSkipDocsNum: _updateSkipDocsNum,
    //     canStillQueryCurrentPageForUsers: !!canStillQueryCurrentPageForUsers,
    // }


    // if (!hasReachedPaginationEnd && (matchesToSendToClient.length < 5)) {
    //     console.time("Getting matches again timing.")
    //     const getValidMatchesResult = await getValidMatches(userQueryOpts, currentUser, matchesToSendToClient, idsOfUsersNotToShow);
    //     console.timeEnd("Getting matches again timing.")

    //     if (getValidMatchesResult.didTimeOut) {
    //         // cache the results of the query
    //         return response.status(408).json({ msg: 'The server is taking longer than usual to get the matches.' })
    //     }

    //     if (getValidMatchesResult.didErrorOccur) {
    //         return response.status(500).json({ msg: 'An error has occurred in getting the matches.' })
    //     }

    //     matchesToSendToClient = (getValidMatchesResult.page as IMatchesPagination).validMatches ?? [];
    // }

    // if (!matchesToSendToClient.length) {
    //     paginationMatchesObj.potentialMatches = [];
    //     return response.status(200).json({ paginationMatches: paginationMatchesObj })
    // }

    // const matchesToSendToClientUpdated: IUserMatch[] = matchesToSendToClient.map((user: unknown) => {
    //     const _user = (user as UserBaseModelSchema);

    //     return { ..._user, firstName: _user.name.first } as unknown as IUserMatch;
    // })
    // const promptsAndMatchingPicForClientResult = await getPromptsAndMatchingPicForClient(matchesToSendToClientUpdated);

    // if (!promptsAndMatchingPicForClientResult.wasSuccessful) {
    //     console.error('Something went wrong. Couldn\'t get prompts and matching pic for client.')
    //     return response.status(500).json({ msg: promptsAndMatchingPicForClientResult.msg })
    // }
    // let potentialMatchesForClient = promptsAndMatchingPicForClientResult.data;
    // potentialMatchesForClient = await getLocationStrForUsers(potentialMatchesForClient as IMatchingPicUser[])
    // console.log('potentialMatchesForClient: ', potentialMatchesForClient)
    // paginationMatchesObj.potentialMatches = potentialMatchesForClient

    // response.status(200).json({ paginationMatches: paginationMatchesObj })
    // console.timeEnd('getMatchesRoute, timing.')
})
