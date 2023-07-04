import { Router, Request, Response } from 'express'
import GLOBAL_VALS from '../../globalVals.js';
import { getMatches } from '../../services/matching/matchesQueryServices.js';
import { ReqQueryMatchesParams, UserQueryOpts } from '../../types-and-interfaces/interfaces/userQueryInterfaces.js';
import { filterUsersWithoutPrompts, getMatchesInfoForClient, getUsersWithPrompts } from '../../services/matching/userMatchesInfoRetrievalServices.js';
import { IFilterUserWithoutPromptsReturnVal, InterfacePotentialMatchesPage, MatchesQueryPage, PotentialMatchesPageMap } from '../../types-and-interfaces/interfaces/matchesQueryInterfaces.js';
import { UserBaseModelSchema } from '../../models/User.js';
import { ReturnTypeQueryForMatchesFn } from '../../types-and-interfaces/types/userQueryTypes.js';
import { IUserAndPrompts } from '../../types-and-interfaces/interfaces/promptsInterfaces.js';
import { User } from 'aws-sdk/clients/budgets.js';

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
    const { status, data, msg } = queryMatchesResults;

    if (!data || !data.potentialMatches || (status !== 200)) {
        console.error("Something went wrong. Couldn't get matches from the database. Message from query result: ", msg)
        console.error('Error status code: ', status)

        return response.status(status).json({ msg: "Something went wrong. Couldnt't matches." })
    }

    const { potentialMatches: getMatchesResultPotentialMatches, hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, updatedSkipDocsNum } = data;
    let { errMsg, potentialMatches: filterUsersWithoutPromptsPotentialMatches, prompts } = await filterUsersWithoutPrompts(getMatchesResultPotentialMatches);

    if (errMsg) {
        console.error("An error has occurred in filtering out users without prompts. Error msg: ", errMsg);

        return response.status(500).json({ msg: `Error! Something went wrong. Couldn't get prompts for users. Error msg: ${errMsg}` })
    }

    let getUsersWithPromptsResult: IFilterUserWithoutPromptsReturnVal = { potentialMatches: filterUsersWithoutPromptsPotentialMatches, prompts }

    if (filterUsersWithoutPromptsPotentialMatches.length < 5) {
        console.log('At least one user does not have any prompts in the db. Will get users with prompts from the database.')
        // data.page.hasValidUsersToDisplayOnCurrentPg is true, then use the current page's skipDocsNum. Else, add 5 to it if it is false
        const updatedSkipDocNumInt = (typeof data.updatedSkipDocsNum === 'string') ? parseInt(data.updatedSkipDocsNum) : data.updatedSkipDocsNum
        const _userQueryOpts = { ...userQueryOpts, skipDocsNum: data.canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) }
        getUsersWithPromptsResult = await getUsersWithPrompts(_userQueryOpts as UserQueryOpts, (query as ReqQueryMatchesParams).userId, filterUsersWithoutPromptsPotentialMatches);
    }


    // this function will return an array of IUsersAndPrompts objects, this function will called when the user has less than 5 potential matches after the check was executed to see if the user has valid matching pic url
    async function getPromptsAndPicUrlsOfUsersAfterPicUrlRetrievalFailure(userQueryOpts: UserQueryOpts, currentUserId: string, potentialMatches: UserBaseModelSchema[]): Promise<Partial<{ potentialMatches: IUserAndPrompts[], errorMsg: string, matchesQueryPage: MatchesQueryPage }>> {
        try {
            const getUsersWithPromptsResult = await getUsersWithPrompts(userQueryOpts, currentUserId, potentialMatches);

            if (getUsersWithPromptsResult.errMsg) {
                throw new Error(`An error has occurred in getting users with prompts. Error msg: ${getUsersWithPromptsResult.errMsg}`)
            }

            if (!getUsersWithPromptsResult.matchesQueryPage) {
                throw new Error("Something went wrong. Couldn't get the matches qeury page object.")
            }

            const potentialMatchesForClientResult = await getMatchesInfoForClient(getUsersWithPromptsResult.potentialMatches, getUsersWithPromptsResult.prompts)
            // get the array that will hold objects with the UserBaseModelSchema in order to query for more users and to call this function recursively

            const { potentialMatches: updatedPotentialMatches, usersWithValidUrlPics: updatedQueriedUsers } = potentialMatchesForClientResult;
            const { hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, updatedSkipDocsNum } = getUsersWithPromptsResult.matchesQueryPage;
            let potentialMatchesPaginationObj = { potentialMatches: updatedPotentialMatches, matchesQueryPage: getUsersWithPromptsResult.matchesQueryPage }

            if ((updatedPotentialMatches.length < 5) && canStillQueryCurrentPageForUsers && !hasReachedPaginationEnd) {
                const _userQueryOpts = { ...userQueryOpts, skipDocsNum: updatedSkipDocsNum }
                const getUsersWithPromptsAndPicUrlsResult = await getPromptsAndPicUrlsOfUsersAfterPicUrlRetrievalFailure(_userQueryOpts, currentUserId, updatedQueriedUsers)

                if (getUsersWithPromptsAndPicUrlsResult.errorMsg) {
                    throw new Error(getUsersWithPromptsAndPicUrlsResult.errorMsg)
                }

                if (!getUsersWithPromptsAndPicUrlsResult.potentialMatches) {
                    throw new Error("Something went wrong. Couldn't get the potential matches array.")
                }

                if (!getUsersWithPromptsAndPicUrlsResult.matchesQueryPage) {
                    throw new Error("Something went wrong. Couldn't get the matches qeury page object.")
                }
                potentialMatchesPaginationObj.potentialMatches = getUsersWithPromptsAndPicUrlsResult.potentialMatches;
                potentialMatchesPaginationObj.matchesQueryPage = getUsersWithPromptsAndPicUrlsResult.matchesQueryPage;
            }


            return potentialMatchesPaginationObj
        } catch (error) {
            const errorMsg = `An error has occurred in getting more users with prompts and pic urls for the user on the client side. Error: ${error}`
            console.error(errorMsg)

            return { errorMsg: errorMsg }
        }
    }

    interface IPotentialMatchesPaginationBuild extends Omit<InterfacePotentialMatchesPage, "potentialMatches"> {
        potentialMatches: UserBaseModelSchema[] | IUserAndPrompts[]
    }
    interface MatchesQueryRespsonseBodyBuild {
        potentialMatchesPagination: IPotentialMatchesPaginationBuild
    }
    interface PotentialMatchesPaginationForClient extends Omit<InterfacePotentialMatchesPage, "potentialMatches"> {
        potentialMatches: IUserAndPrompts[]
    }
    interface MatchesQueryResponseBody {
        potentialMatchesPagination: PotentialMatchesPaginationForClient
    }

    let potentialMatchesToDisplayToUserOnClient: IUserAndPrompts[] | UserBaseModelSchema[] = getUsersWithPromptsResult.potentialMatches;
    let responseBody: MatchesQueryRespsonseBodyBuild | MatchesQueryResponseBody = { potentialMatchesPagination: { ...data, potentialMatches: potentialMatchesToDisplayToUserOnClient } }

    if ((potentialMatchesToDisplayToUserOnClient.length === 0)) {
        return response.status(status).json(responseBody)
    }

    const potentialMatchesForClientResult = await getMatchesInfoForClient(potentialMatchesToDisplayToUserOnClient, getUsersWithPromptsResult.prompts);
    responseBody.potentialMatchesPagination.potentialMatches = potentialMatchesForClientResult.potentialMatches;

    console.log('Potential matches info has been retrieved. Will check if the user has valid pic urls.')


    if ((potentialMatchesForClientResult.potentialMatches.length < 5) && !hasReachedPaginationEnd) {
        console.log("At least one user does not have a valid pic url. Will get more users with prompts and valid pic urls.")

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

    return response.status(status).json(responseBody)
})
