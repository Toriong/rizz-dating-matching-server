import { Router, Request, Response } from 'express'
import GLOBAL_VALS from '../../globalVals.js';
import { getMatches } from '../../services/matching/matchesQueryServices.js';
import { ReqQueryMatchesParams, UserQueryOpts } from '../../types-and-interfaces/interfaces/userQueryInterfaces.js';
import { filterUsersWithoutPrompts, getPromptsImgUrlsAndUserInfo, getPromptsAndPicUrlsOfUsersAfterPicUrlOrPromptsRetrievalHasFailed, getUsersWithPrompts } from '../../services/matching/userMatchesInfoRetrievalServices.js';
import { IFilterUserWithoutPromptsReturnVal, InterfacePotentialMatchesPage, MatchesQueryPage, PotentialMatchesPageMap, PotentialMatchesPaginationForClient } from '../../types-and-interfaces/interfaces/matchesQueryInterfaces.js';
import { UserBaseModelSchema } from '../../models/User.js';
import { ReturnTypeQueryForMatchesFn } from '../../types-and-interfaces/types/userQueryTypes.js';
import { IUserAndPrompts } from '../../types-and-interfaces/interfaces/promptsInterfaces.js';
import { User } from 'aws-sdk/clients/budgets.js';
import { MatchesQueryResponseBody, MatchesQueryRespsonseBodyBuild } from '../../types-and-interfaces/interfaces/responses/getMatches.js';

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

    const isRadiusSetToAnywhereValidtionObj = { receivedType: typeof isRadiusSetToAnywhere, correctVal: 'boolean', fieldName: 'isRadiusSetToAnywhere', isCorrectValType: typeof isRadiusSetToAnywhere === 'boolean', val: isRadiusSetToAnywhere }

    return [...defaultValidationKeyValsArr, isRadiusSetToAnywhereValidtionObj]
}

getMatchesRoute.get(`/${GLOBAL_VALS.matchesRootPath}/get-matches`, async (request: Request, response: Response) => {
    console.time('getMatchesRoute')
    let query: unknown | ReqQueryMatchesParams = request.query

    if (!query || !(query as ReqQueryMatchesParams)?.query || !(query as ReqQueryMatchesParams).userId) {
        return response.status(400).json({ msg: 'Missing query parameters.' })
    }

    let userQueryOpts: RequestQuery | UserQueryOpts = (query as ReqQueryMatchesParams).query;
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
    const { userLocation, skipDocsNum } = userQueryOpts as UserQueryOpts;
    const paginationPageNumUpdated = parseInt(skipDocsNum as string)
    const _userLocation = [userLocation[0] as string, userLocation[1] as string].map(val => parseFloat(val))

    if (userQueryOpts?.minAndMaxDistanceArr?.length) {
        userQueryOpts = { ...userQueryOpts, skipDocsNum: paginationPageNumUpdated, userLocation: _userLocation, minAndMaxDistanceArr: userQueryOpts.minAndMaxDistanceArr } as UserQueryOpts;
    }


    // if the user wants to query based on the radius set to anywhere get the users that blocked the current user nad the users that were blocked by the current user 
    // get also the users that the current user is chatting with

    if (userQueryOpts.isRadiusSetToAnywhere) {
        userQueryOpts = { ...userQueryOpts, skipDocsNum: paginationPageNumUpdated, isRadiusSetToAnywhere: true }
    }

    console.log('will query for matches...')

    const queryMatchesResults = await getMatches(userQueryOpts as UserQueryOpts, (query as ReqQueryMatchesParams).userId);

    if (!queryMatchesResults.data || !queryMatchesResults?.data?.potentialMatches || (queryMatchesResults.status !== 200)) {
        console.error("Something went wrong. Couldn't get matches from the database. Message from query result: ", queryMatchesResults.msg)
        console.error('Error status code: ', queryMatchesResults.status)

        return response.status(queryMatchesResults.status).json({ msg: "Something went wrong. Couldnt't matches." })
    }

    const { potentialMatches: getMatchesResultPotentialMatches, hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, updatedSkipDocsNum } = queryMatchesResults.data;
    let { errMsg, potentialMatches: filterUsersWithoutPromptsArr, prompts } = await filterUsersWithoutPrompts(getMatchesResultPotentialMatches);

    console.log("filterUsersWithoutPrompts function has been executed. Will check if there was an error.")

    if (errMsg) {
        console.error("An error has occurred in filtering out users without prompts. Error msg: ", errMsg);

        return response.status(500).json({ msg: `Error! Something went wrong. Couldn't get prompts for users. Error msg: ${errMsg}` })
    }

    let getUsersWithPromptsResult: IFilterUserWithoutPromptsReturnVal = { potentialMatches: filterUsersWithoutPromptsArr, prompts }

    // at least one user doesn't have any prompts in the db
    if (filterUsersWithoutPromptsArr.length < 5) {
        console.log('At least one user does not have any prompts in the db. Will get users with prompts from the database.')
        const updatedSkipDocNumInt = (typeof queryMatchesResults.data.updatedSkipDocsNum === 'string') ? parseInt(queryMatchesResults.data.updatedSkipDocsNum) : queryMatchesResults.data.updatedSkipDocsNum
        const _userQueryOpts = { ...userQueryOpts, skipDocsNum: queryMatchesResults.data.canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) }
        getUsersWithPromptsResult = await getUsersWithPrompts(_userQueryOpts as UserQueryOpts, (query as ReqQueryMatchesParams).userId, filterUsersWithoutPromptsArr);
    }

    let potentialMatchesToDisplayToUserOnClient: IUserAndPrompts[] | UserBaseModelSchema[] = getUsersWithPromptsResult.potentialMatches;
    let responseBody: MatchesQueryRespsonseBodyBuild | MatchesQueryResponseBody = { potentialMatchesPagination: { ...queryMatchesResults.data, potentialMatches: potentialMatchesToDisplayToUserOnClient } }

    if ((potentialMatchesToDisplayToUserOnClient.length === 0)) {
        return response.status(200).json(responseBody)
    }

    console.log('Getting matches info for client...')

    const potentialMatchesForClientResult = await getPromptsImgUrlsAndUserInfo(potentialMatchesToDisplayToUserOnClient, getUsersWithPromptsResult.prompts);
    responseBody.potentialMatchesPagination.potentialMatches = potentialMatchesForClientResult.potentialMatches;

    console.log('Potential matches info has been retrieved. Will check if the user has valid pic urls.')

    // create a manual get request in the caritas application front end 

    // at least one user does not have a valid url matching pic stored in aws s3 or does not have any prompts stored in the db. 
    if ((potentialMatchesForClientResult.potentialMatches.length < 5) && !hasReachedPaginationEnd) {
        console.log("potentialMatchesForClientResult.potentialMatches: ", potentialMatchesForClientResult.potentialMatches)
        console.log("At least one user does not have a valid url matching pic stored in aws s3 or does not have any prompts stored in the db.")
        const updatedSkipDocNumInt = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum
        const _userQueryOpts: UserQueryOpts = { ...userQueryOpts, skipDocsNum: canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) }
        const getMoreUsersAfterPicUrlFailureResult = await getPromptsAndPicUrlsOfUsersAfterPicUrlOrPromptsRetrievalHasFailed(_userQueryOpts, (query as ReqQueryMatchesParams).userId, potentialMatchesForClientResult.usersWithValidUrlPics)

        console.log("getMoreUsersAfterPicUrlFailureResult.potentialMatches: ", getMoreUsersAfterPicUrlFailureResult.potentialMatches)

        if (!getMoreUsersAfterPicUrlFailureResult.matchesQueryPage) {
            console.error("Something went wrong. Couldn't get the matches query page object. Will send the available potential matches to the client.")

            return response.status(200).json(responseBody as MatchesQueryResponseBody)
        }

        if (getMoreUsersAfterPicUrlFailureResult.errorMsg) {
            console.error("Failed to get more users with valid pic urls. Sending current matches that have valid pic aws urls. Error message: ", getMoreUsersAfterPicUrlFailureResult.errorMsg)
            responseBody = { potentialMatchesPagination: { ...getMoreUsersAfterPicUrlFailureResult.matchesQueryPage, potentialMatches: potentialMatchesForClientResult.potentialMatches } }

            return response.status(200).json(responseBody as MatchesQueryResponseBody)
        }

        if (getMoreUsersAfterPicUrlFailureResult.potentialMatches?.length) {
            console.log("Potential matches received after at least one user did not have valid prompts or a matching pic url. Will send them to the client.");
            responseBody = { potentialMatchesPagination: { ...getMoreUsersAfterPicUrlFailureResult.matchesQueryPage, potentialMatches: getMoreUsersAfterPicUrlFailureResult.potentialMatches } }
        }

        if (!getMoreUsersAfterPicUrlFailureResult.potentialMatches?.length || !getMoreUsersAfterPicUrlFailureResult.potentialMatches) {
            console.log('No potential matches to display to the user on the client side.')
            responseBody = { potentialMatchesPagination: { ...getMoreUsersAfterPicUrlFailureResult.matchesQueryPage, potentialMatches: [] } }
        }
    }
    console.timeEnd('getMatchesRoute')

    console.log("Potential matches has been retrieved. Will send them to the client.")


    return response.status(200).json(responseBody)
})
