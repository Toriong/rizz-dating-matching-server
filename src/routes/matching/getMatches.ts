import { Router, Request, Response } from 'express'
import GLOBAL_VALS from '../../globalVals.js';
import { getMatches } from '../../services/matching/matchesQueryServices.js';
import { ReqQueryMatchesParams, UserQueryOpts } from '../../types-and-interfaces/interfaces/userQueryInterfaces.js';
import { filterUsersWithoutPrompts, getMatchesInfoForClient, getUsersWithPrompts } from '../../services/matching/userMatchesInfoRetrievalServices.js';
import { IFilterUserWithouPromptsReturnVal } from '../../types-and-interfaces/interfaces/matchesQueryInterfaces.js';
import { UserBaseModelSchema } from '../../models/User.js';

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

    if (!data) {
        console.error("Something went wrong. Couldn't get matches from the database. Message from query result: ", msg)

        return response.status(500).json({ msg: "Something went wrong. Couldnt't matches." })
    }

    const { potentialMatches: getMatchesResultPotentialMatches, hasReachedPaginationEnd, canStillQueryCurrentPageForUsers } = data;
    let { errMsg, potentialMatches: filterUsersWithoutPromptsPotentialMatches, prompts } = await filterUsersWithoutPrompts(getMatchesResultPotentialMatches);

    if (errMsg) {
        console.error("An error has occurred in filtering out users without prompts. Error msg: ", errMsg);

        return response.status(500).json({ msg: `Error! Something went wrong. Couldn't get prompts for users. Error msg: ${errMsg}` })
    }

    let getUsersWithPromptsResult: IFilterUserWithouPromptsReturnVal = { potentialMatches: filterUsersWithoutPromptsPotentialMatches, prompts }

    if (filterUsersWithoutPromptsPotentialMatches.length < 5) {
        console.log('At least one user does not have any prompts in the db. Will get users with prompts from the database.')
        // data.page.hasValidUsersToDisplayOnCurrentPg is true, then use the current page's skipDocsNum. Else, add 5 to it if it is false
        const updatedSkipDocNumInt = (typeof data.updatedSkipDocsNum === 'string') ? parseInt(data.updatedSkipDocsNum) : data.updatedSkipDocsNum
        const _userQueryOpts = { ...userQueryOpts, skipDocsNum: data.canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) }
        getUsersWithPromptsResult = await getUsersWithPrompts(_userQueryOpts as UserQueryOpts, (query as ReqQueryMatchesParams).userId, filterUsersWithoutPromptsPotentialMatches);
    }

    // BRAIN DUMP:
    // not enough users to show to the user on the client side after querying for the pic urls of the users
    // get more users check for the following by using a function that can be called recursively:
    // 1) if the user has prompts
    // 2) if the user has pic urls

    async function getUsersWithPromptsAndPicUrls(userQueryOpts: UserQueryOpts, currentUserId: string, potentialMatches: UserBaseModelSchema[]){
        try{
            const getUsersWithPromptsResult = await getUsersWithPrompts(userQueryOpts, currentUserId, potentialMatches);

            if(getUsersWithPromptsResult.errMsg){
                throw new Error(`An error has occurred in getting users with prompts. Error msg: ${getUsersWithPromptsResult.errMsg}`)
            }
        } catch(error){
            console.error("An error has occurred in getting more users with prompts and pic urls for the user on the client side. Error: ", error)

            return { potentialMatches: [], prompts: [], didErrorOccur: true }
        }
    }


    if (getUsersWithPromptsResult.potentialMatches.length > 0) {
        const { potentialMatches, prompts } = getUsersWithPromptsResult;
        const potentialMatchesForClient = await getMatchesInfoForClient(potentialMatches, prompts);
        // if the results above is less than potentialMatches length and if the potentialMatches length was 5, then its means the following:

        // either the user doesn't have any prompts or the user doesn't a matching pic url stored in aws

        // CASE #1
        // either way, if potentialMatchesForClient is less than 5 and if hasReachedPaginationEnd is true, then it means that the user has no more potential matches to display for the current query
        // and that they are no more users to query to show to the user on the front end
        // GOAL: send the current potentialMatchesForClient to the frontend

        // CASE #2:
        // if potentialMatchesForClient is less than 5 and hasReachedPaginationEnd is false and canStillQueryCurrentPageForUsers is true, then query for more users to replace the users that don't have matching 
        // pic urls stored in aws  
        // GOAL: get more users to show to the user on the client side starting with the current page using the current number of documents to skip to show to the user on the client side
        // the next batch of users are attained

        // CASE #3:
        // if potentialMatchesForClient is less than 5 and hasReachedPaginationEnd is false and canStillQueryCurrentPageForUsers is false, then query for more users to replace the users that don't have matching 
        // pic urls stored in aws starting with the next page
        // GOAL: get moe users to show to the user starting with the next page of users  

    }

    const responseBody = (status === 200) ? { potentialMatchesPagination: { ...data, potentialMatches: getUsersWithPromptsResult.potentialMatches } } : { msg: msg }

    return response.status(status).json(responseBody)
})
