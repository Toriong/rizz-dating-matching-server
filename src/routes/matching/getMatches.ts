import { Router, Request, Response } from 'express'
import GLOBAL_VALS from '../../globalVals.js';
import { getMatches } from '../../services/matching/matchesQueryServices.js';
import { ReqQueryMatchesParams, UserQueryOpts } from '../../types-and-interfaces/interfaces/userQueryInterfaces.js';
import { filterUsersWithoutPrompts, getMatchesInfoForClient, getPromptsAndPicUrlsOfUsersAfterPicUrlRetrievalFailure, getUsersWithPrompts } from '../../services/matching/userMatchesInfoRetrievalServices.js';
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
    areFieldNamesPresent?: boolean,
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
    console.log('checking options of query. queryOpts: ', queryOpts)
    const validSexes = ['Male', 'Female']
    const { userLocation, desiredAgeRange, skipDocsNum, radiusInMilesInt } = queryOpts ?? {}
    console.log('desiredAgeRange: ', desiredAgeRange)
    const { latitude, longitude } = userLocation ?? {};
    const areValsInDesiredAgeRangeArrValid = (Array.isArray(desiredAgeRange) && (desiredAgeRange.length === 2)) && desiredAgeRange.every(date => !Number.isNaN(Date.parse(date)));
    const areDesiredAgeRangeValsValid = { receivedType: typeof desiredAgeRange, recievedTypeOfValsInArr: desiredAgeRange.map(ageDate => typeof ageDate), correctVal: 'object', fieldName: 'desiredAgeRange', isCorrectValType: areValsInDesiredAgeRangeArrValid, val: desiredAgeRange }
    const isLongAndLatValueTypeValid = (!!longitude && !!latitude) && ((typeof parseFloat(longitude as string) === 'number') && (typeof parseFloat(latitude as string) === 'number'))
    const isLongAndLatValid = { receivedType: typeof userLocation, recievedTypeOfValsInArr: Object.keys(userLocation).map(key => validateFormOfObj(key, userLocation)), correctVal: 'number', fieldName: 'userLocation', isCorrectValType: isLongAndLatValueTypeValid, val: userLocation, areFiedNamesPresent: !!latitude && !!longitude }
    const paginationPageNumValidationObj = { receivedType: typeof skipDocsNum, correctVal: 'number', fieldName: 'skipDocsNum', isCorrectValType: typeof parseInt(skipDocsNum as string) === 'number', val: skipDocsNum }
    const radiusValidationObj = { receivedType: typeof radiusInMilesInt, correctVal: 'number', fieldName: 'radiusInMilesInt', isCorrectValType: typeof parseInt(radiusInMilesInt as string) === 'number', val: radiusInMilesInt }

    return [radiusValidationObj, paginationPageNumValidationObj, isLongAndLatValid, areDesiredAgeRangeValsValid];
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

    const userlocationValsUpdated = { longitude: parseFloat(userQueryOpts.userLocation.longitude as string), latitude: parseFloat(userQueryOpts.userLocation.latitude as string) }
    const valOfRadiusFieldUpdated = parseInt(userQueryOpts.radiusInMilesInt as string)
    const paginationPageNumUpdated = parseInt(userQueryOpts.skipDocsNum as string)
    userQueryOpts = { ...userQueryOpts, skipDocsNum: paginationPageNumUpdated, userLocation: userlocationValsUpdated, radiusInMilesInt: valOfRadiusFieldUpdated }

    console.log('will query for matches...')

    const queryMatchesResults = await getMatches(userQueryOpts as UserQueryOpts, (query as ReqQueryMatchesParams).userId);

    if (!queryMatchesResults.data || !queryMatchesResults?.data?.potentialMatches || (queryMatchesResults.status !== 200)) {
        console.error("Something went wrong. Couldn't get matches from the database. Message from query result: ", queryMatchesResults.msg)
        console.error('Error status code: ', queryMatchesResults.status)

        return response.status(queryMatchesResults.status).json({ msg: "Something went wrong. Couldnt't matches." })
    }

    const { potentialMatches: getMatchesResultPotentialMatches, hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, updatedSkipDocsNum } = queryMatchesResults.data;
    let { errMsg, potentialMatches: filterUsersWithoutPromptsPotentialMatches, prompts } = await filterUsersWithoutPrompts(getMatchesResultPotentialMatches);

    console.log("filterUsersWithoutPrompts function has been executed. Will check if there was an error.")

    if (errMsg) {
        console.error("An error has occurred in filtering out users without prompts. Error msg: ", errMsg);

        return response.status(500).json({ msg: `Error! Something went wrong. Couldn't get prompts for users. Error msg: ${errMsg}` })
    }

    let getUsersWithPromptsResult: IFilterUserWithoutPromptsReturnVal = { potentialMatches: filterUsersWithoutPromptsPotentialMatches, prompts }

    // at least one user doesn't have any prompts in the db
    if (filterUsersWithoutPromptsPotentialMatches.length < 5) {
        console.log('At least one user does not have any prompts in the db. Will get users with prompts from the database.')
        const updatedSkipDocNumInt = (typeof queryMatchesResults.data.updatedSkipDocsNum === 'string') ? parseInt(queryMatchesResults.data.updatedSkipDocsNum) : queryMatchesResults.data.updatedSkipDocsNum
        const _userQueryOpts = { ...userQueryOpts, skipDocsNum: queryMatchesResults.data.canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) }
        getUsersWithPromptsResult = await getUsersWithPrompts(_userQueryOpts as UserQueryOpts, (query as ReqQueryMatchesParams).userId, filterUsersWithoutPromptsPotentialMatches);
    }

    let potentialMatchesToDisplayToUserOnClient: IUserAndPrompts[] | UserBaseModelSchema[] = getUsersWithPromptsResult.potentialMatches;
    let responseBody: MatchesQueryRespsonseBodyBuild | MatchesQueryResponseBody = { potentialMatchesPagination: { ...queryMatchesResults.data, potentialMatches: potentialMatchesToDisplayToUserOnClient } }

    if ((potentialMatchesToDisplayToUserOnClient.length === 0)) {
        return response.status(200).json(responseBody)
    }

    console.log('Getting matches info for client...')

    const potentialMatchesForClientResult = await getMatchesInfoForClient(potentialMatchesToDisplayToUserOnClient, getUsersWithPromptsResult.prompts);
    responseBody.potentialMatchesPagination.potentialMatches = potentialMatchesForClientResult.potentialMatches;

    console.log('Potential matches info has been retrieved. Will check if the user has valid pic urls.')


    // at least one user does not have a valid url matching pic stored in aws s3
    if ((potentialMatchesForClientResult.potentialMatches.length < 5) && !hasReachedPaginationEnd) {
        const updatedSkipDocNumInt = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum
        const _userQueryOpts: UserQueryOpts = { ...userQueryOpts, skipDocsNum: canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) }
        const getMoreUsersAfterPicUrlFailureResult = await getPromptsAndPicUrlsOfUsersAfterPicUrlRetrievalFailure(_userQueryOpts, (query as ReqQueryMatchesParams).userId, potentialMatchesForClientResult.usersWithValidUrlPics)

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
            responseBody = { potentialMatchesPagination: { ...getMoreUsersAfterPicUrlFailureResult.matchesQueryPage, potentialMatches: getMoreUsersAfterPicUrlFailureResult.potentialMatches } }
        }

        if (!getMoreUsersAfterPicUrlFailureResult.potentialMatches?.length) {
            responseBody = { potentialMatchesPagination: { ...getMoreUsersAfterPicUrlFailureResult.matchesQueryPage, potentialMatches: [] } }
        }
    }
    console.timeEnd('getMatchesRoute')

    console.log("Potential matches has been retrieved. Will send them to the client.")


    return response.status(200).json(responseBody)
})
