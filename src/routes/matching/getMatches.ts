import mongoose from 'mongoose';
import { Router, Request, Response } from 'express'
import { insertRejectedUser } from "../../services/rejectingUsers/rejectedUsersService.js";
import GLOBAL_VALS from '../../globalVals.js';
import { getMatches } from '../../services/matching/matchesQueryServices.js';
import { ReqQueryMatchesParams, UserLocation, UserQueryOpts } from '../../types-and-interfaces/interfaces/userQueryInterfaces.js';
import { PaginatedModel } from '../../models/User.js';
import { filterUsersWithoutPrompts, getUsersWithPrompts } from '../../services/matching/userMatchesInfoRetrievalServices.js';
import { IFilterUserWithouPromptsReturnVal } from '../../types-and-interfaces/interfaces/matchesQueryInterfaces.js';

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

    let { didErrorOccur, potentialMatches } = await filterUsersWithoutPrompts(data.potentialMatches);

    if (didErrorOccur) {
        console.error("An error has occurred in filtering out users wihtout prompts.");

        return response.status(500).json({ msg: "Error! Something went wrong. Couldn't get prompts for users." })
    }

    let getUsersWithPromptsResult: IFilterUserWithouPromptsReturnVal = { potentialMatches: [], prompts: [] }

    if (potentialMatches.length < 5) {
        getUsersWithPromptsResult = await getUsersWithPrompts(userQueryOpts as UserQueryOpts, (query as ReqQueryMatchesParams).userId, potentialMatches);

        if (getUsersWithPromptsResult.didErrorOccur) {
            console.error("Potential matches is less than 5. Couldn't prompts for the users.");

            return response.status(500).json({ msg: "Error! Something went wrong. Couldn't get prompts for users." })
        }
    }

    // if the potentialmatches array is greater than 0, then for each user get their matching photo from aws. 

    const responseBody = (status === 200) ? { potentialMatchesPagination: { ...data, potentialMatches: getUsersWithPromptsResult.potentialMatches } } : { msg: msg }

    return response.status(status).json(responseBody)
})
