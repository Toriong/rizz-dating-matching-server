import { User as Users, PaginationQueryingOpts, UserBaseModelSchema, UserLocation } from "../../models/User.js"
import { UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";
import { RejectedUserInterface } from "../../types-and-interfaces/interfaces/rejectedUserDocsInterfaces.js";
import { IUserMatch, InterfacePotentialMatchesPage } from "../../types-and-interfaces/interfaces/matchesQueryInterfaces.js";
import { getMatchesWithPrompts } from "../promptsServices/getPromptsServices.js";
import { getMatchingPicUrlForUsers } from "./helper-fns/aws.js";
import moment from "moment";
import dotenv from 'dotenv';
import axios from 'axios'

interface GetMatchesResult {
    status: number,
    data?: InterfacePotentialMatchesPage,
    msg?: string
}

interface IQueryOptsForPagination {
    skipAndLimitObj: {
        skip: number
        limit: number
    },
    paginationQueryOpts: PaginationQueryingOpts,
    currentPageNum: number
}

function createQueryOptsForPagination(userQueryOpts: UserQueryOpts, currentUser: UserBaseModelSchema, allUnshowableUserIds: string[]): IQueryOptsForPagination {
    const { userLocation, minAndMaxDistanceArr, desiredAgeRange, skipDocsNum, isRadiusSetToAnywhere } = userQueryOpts;
    const currentPageNum = (skipDocsNum as number) / 5;
    const METERS_IN_A_MILE = 1609.34;
    const [minAge, maxAge] = desiredAgeRange;
    const paginationQueryOpts: PaginationQueryingOpts = {
        sex: (currentUser.sex === 'Male') ? 'Female' : 'Male',
        hasPrompts: true,
        sexAttraction: currentUser.sexAttraction,
        birthDate: { $gt: moment.utc(minAge).toDate(), $lt: moment.utc(maxAge).toDate() }
    }

    if (allUnshowableUserIds?.length) {
        paginationQueryOpts._id = { $nin: allUnshowableUserIds };
    }

    if (userLocation && minAndMaxDistanceArr && !isRadiusSetToAnywhere) {
        const [latitude, longitude] = userLocation as [number, number];
        const [minDistance, maxDistance] = minAndMaxDistanceArr as [number, number];
        paginationQueryOpts.location = {
            $near: {
                $geometry: { type: "Point", coordinates: [longitude, latitude] },
                $maxDistance: (maxDistance) * METERS_IN_A_MILE,
                $minDistance: (minDistance ?? 0) * METERS_IN_A_MILE
            }
        }
    }

    // brain dump:
    // have the limit be 30, in order to perform faster queries

    const skipAndLimitObj = { skip: skipDocsNum as number, limit: 5 };
    const returnVal = { skipAndLimitObj, paginationQueryOpts, currentPageNum };

    return returnVal;
}

async function queryForPotentialMatches(queryOptsForPagination: IQueryOptsForPagination, skipDocsNum: number): Promise<InterfacePotentialMatchesPage> {
    let { skipAndLimitObj, paginationQueryOpts, currentPageNum } = queryOptsForPagination;
    let updatedSkipDocsNum = skipDocsNum + 5;

    if (paginationQueryOpts?.location) {
        (Users as any).createIndexes([{ location: '2dsphere' }])
    }

    // THE BELOW IS FOR TESTING:
    // skip: 50, limit: 5, the users of the sixth page
    // skip: 55, limit: 5, the users of the seventh page
    // skipAndLimitObj = { skip: 100, limit: 5  };
    // THE ABOVE IS FOR TESTING:

    // BRAIN DUMP:
    // get the first 50 users, get all of their ids, and check for the following:
    // if they have valid prompts
    // and matching pic url

    const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count()
    const potentialMatchesPromise = Users.find(paginationQueryOpts, null, skipAndLimitObj).sort({ ratingNum: 'desc' }).lean()
    let [totalUsersForQuery, potentialMatches]: [number, UserBaseModelSchema[]] = await Promise.all([totalUsersForQueryPromise, potentialMatchesPromise])
    const hasReachedPaginationEnd = (5 * currentPageNum) >= totalUsersForQuery;

    if (totalUsersForQuery === 0) {
        return { potentialMatches: [], updatedSkipDocsNum: 0, canStillQueryCurrentPageForUsers: false, hasReachedPaginationEnd: true }
    }


    if (hasReachedPaginationEnd) {
        return { potentialMatches: potentialMatches, updatedSkipDocsNum, canStillQueryCurrentPageForUsers: false, hasReachedPaginationEnd: true }
    }

    return { potentialMatches: potentialMatches, updatedSkipDocsNum, hasReachedPaginationEnd: (5 * currentPageNum) >= totalUsersForQuery }
}

function getIdsOfUsersNotToShow(currentUserId: string, rejectedUsers: RejectedUserInterface[], allRecipientsOfChats: string[]): string[] {
    const allRejectedUserIds = [
        ...new Set((rejectedUsers)
            .flatMap((rejectedUserInfo: RejectedUserInterface) => {
                return [rejectedUserInfo.rejectedUserId, rejectedUserInfo.rejectorUserId]
            })
            .filter(userId => currentUserId !== userId))
    ]

    return [...allRejectedUserIds, ...allRecipientsOfChats]
}

// get the users of the sixth page
async function getMatches(queryOptsForPagination: IQueryOptsForPagination, skipDocsNum: number): Promise<GetMatchesResult> {
    try {
        const potentialMatchesPaginationObj = await queryForPotentialMatches(queryOptsForPagination, skipDocsNum);

        return { status: 200, data: { ...potentialMatchesPaginationObj } }
    } catch (error) {
        console.error('An error has occurred in getting matches: ', error)
        const errMsg = `An error has occurred in getting matches for user: ${error}`

        return { status: 500, msg: errMsg }
    }
}

function getCountryName(countryCode: string): string | undefined {
    let regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

    return regionNames.of(countryCode)
}

async function getReverseGeoCode(userLocation: [number, number]): Promise<{ wasSuccessful: boolean, data?: string }> {
    try {
        dotenv.config();
        const [longitude, latitude] = userLocation;
        const reverseGeoCodeUrl = `http://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=5&appid=${process.env.REVERSE_GEO_LOCATION_API_KEY}`
        const response = await axios.get(reverseGeoCodeUrl);
        const { status, data } = response;

        if (status !== 200) {
            throw new Error("Failed to get reverse geocode.")
        };

        console.log('Recevied reverse geo code data: ', data?.[0])

        const { name: city, state, country } = data[0];
        const countryName = getCountryName(country);

        if (!countryName) {
            throw new Error("Failed to get country name.")
        }

        const userLocationStr = state ? `${city}, ${state}, ${countryName}` : `${city}, ${countryName}`

        return { wasSuccessful: true, data: userLocationStr }
    } catch (error) {
        console.error("Failed to get the reverse geocode of the user's location. Error message: ", error)

        return { wasSuccessful: false }
    }
}

async function getLocationStrForUsers(users: IUserMatch[]): Promise<IUserMatch[]> {
    let usersUpdated = [] as IUserMatch[];

    for (let numIteration = 0; numIteration < users.length; numIteration++) {
        let userMap = new Map(Object.entries(users[numIteration]));
        let userLocation = userMap.get('location') as unknown as UserLocation;
        const userLocationStrResult = await getReverseGeoCode(userLocation.coordinates);

        if (userLocationStrResult.wasSuccessful) {
            userMap.set('locationStr', userLocationStrResult.data as string)
            userMap.delete('location');
        } else {
            userMap.set('locationErrorMsg', "Unable to get user's location.")
        }

        userMap.delete('pics')
        userMap.delete('name')
        usersUpdated.push(Object.fromEntries(userMap) as IUserMatch)
    }

    return usersUpdated;
}

async function getPromptsAndMatchingPicForClient(matches: IUserMatch[]) {
    try {
        const matchesWithPromptsResult = await getMatchesWithPrompts(matches);

        if (!matchesWithPromptsResult.wasSuccessful) {
            throw new Error('Failed to get prompts for matches.')
        }

        const matchesWithPicsResult = await getMatchingPicUrlForUsers(matchesWithPromptsResult.data as IUserMatch[])

        if (!matchesWithPicsResult.wasSuccessful) {
            throw new Error('An error has occurred in getting matching pic for users.')
        }


        return { wasSuccessful: true, data: matchesWithPicsResult.data }
    } catch (error: any) {
        console.error('Getting prompts and matching pic for client error: ', error);

        return { wasSuccessful: false, msg: 'Getting prompts and matching pic for client error: ' + error?.message }
    }
}


export { getMatches, createQueryOptsForPagination, getIdsOfUsersNotToShow, getPromptsAndMatchingPicForClient, getLocationStrForUsers }