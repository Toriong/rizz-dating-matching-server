import mongoose from 'mongoose';
import { Router, Request, Response } from 'express'
import { insertRejectedUser } from "../../services/rejectingUsers/rejectedUsersService.js";
import GLOBAL_VALS from '../../globalVals.js';
import { getMatches } from '../../services/matching/matchesQueryServices.js';
import { ReqQueryMatchesParams, UserLocation, UserQueryOpts } from '../../types-and-interfaces/interfaces/userQueryInterfaces.js';
import { PaginatedModel } from '../../models/User.js';

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

    console.log('get matches for user on the client-side query: ', query)

    if (!query || !(query as ReqQueryMatchesParams)?.query || !(query as ReqQueryMatchesParams).userId) {
        return response.status(400).json({ msg: 'Missing query parameters.' })
    }

    // query will receive the following: { query: this will be all of the query options, userId: the id of the user that is making the request }
    
    let userQueryOpts: RequestQuery | UserQueryOpts = (query as ReqQueryMatchesParams).query;

    console.log("userQueryOpts: ", userQueryOpts)
    console.log('userQueryOpts desiredAgeRange: ', userQueryOpts.desiredAgeRange)

    const queryOptsValidArr = getQueryOptionsValidationArr(userQueryOpts);
    const areQueryOptsValid = queryOptsValidArr.every(queryValidationObj => queryValidationObj.isCorrectValType)

    // filter in all of the query options validtion results with the field of isCorrectValType of false
    if (!areQueryOptsValid) {
        const invalidQueryOpts = queryOptsValidArr.filter(({ isCorrectValType }) => !isCorrectValType)

        console.table(invalidQueryOpts)

        console.error('An errror has occurred. Invalid query parameters.')

        return response.status(400).json({ msg: 'Invalid query parameters.' })
    }

    console.log("Will get the user's matches and send them to the client.")

    // access the userQuerOpts.desireDateRange, loop through it using the map method, and change the date strings to date objects
    const userlocationValsUpdated = { longitude: parseFloat(userQueryOpts.userLocation.longitude as string), latitude: parseFloat(userQueryOpts.userLocation.latitude as string) }
    const valOfRadiusFieldUpdated = parseInt(userQueryOpts.radiusInMilesInt as string)
    const paginationPageNumUpdated = parseInt(userQueryOpts.skipDocsNum as string)
    userQueryOpts = { ...userQueryOpts, skipDocsNum: paginationPageNumUpdated, userLocation: userlocationValsUpdated, radiusInMilesInt: valOfRadiusFieldUpdated }

    console.log('will query for matches...')

    const queryMatchesResults = await getMatches(userQueryOpts as UserQueryOpts, (query as ReqQueryMatchesParams).userId);
    const { status, data, msg } = queryMatchesResults;

    if(!data){
        console.error("Something went wrong. Couldn't get matches from the database. Message from query result: ", msg)

        return response.status(500).json({ msg: "Something went wrong. Couldnt't matches." })
    }


    // GOAL: for the user in the data array, check if the users has any prompts in the database

    // BRAIN DUMP: 
    // get the prompts of the user, and with the users that was return from getMatches function, execute a filter. If the users in the data array that
    // was return from getMatches are not in the prompts array, then filter out those users from the data array return from the getMatches function
    
    
    // BRAIN DUMP: 
    // create a recursive function that will get the user's prompts from the database
    // after the checking if the user has any prompts in the database, and if at least one user do not have any prompts then call a recursive function that will get the users with prompts from the database 
    // the above function will do the following:
    // get the users with propmts from the database
    // will check if the user has any prompts in the db
    // if no prompts, then call the function again
    // else, return the result of the query for this function
    // the function will get the number of users that do have prompts 
    // the current page number that the user is on (the amount of users that has been skipped already)
    // check if the current page has any querable users
    
    // CASE: after querying for the user's prompts, at least one user has not prompts in the db.
    // GOAL: make another querying into the database in order to get prompts of users who do have prompts
     



    // GOAL #2: the logic that gets the user's prompts from the database is executed and the results are received
    // CASE: all of the users that were queried do not have any prompts
    // the results are received. In this case, all of the user has no prompts to display to the user on the client side.
    // the results from querying the prompts collection is executed and the results are received.
    // using the ids of the user, get the prompts of the users
    // get all of the userIds of the matches 



    const responseBody = (status === 200) ? { potentialMatchesPagination: data } : { msg: msg }

    return response.status(status).json(responseBody)
})
