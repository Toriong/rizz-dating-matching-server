import { User as Users, PaginationQueryingOpts, UserBaseModelSchema, UserLocation } from "../../models/User.js"
import { UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";
import { RejectedUserInterface } from "../../types-and-interfaces/interfaces/rejectedUserDocsInterfaces.js";
import { IGetValidMatches, IMatchesPagination, IUserMatch, InterfacePotentialMatchesPage } from "../../types-and-interfaces/interfaces/matchesQueryInterfaces.js";
import { filterInUsersWithPrompts, getMatchesWithPrompts } from "../promptsServices/getPromptsServices.js";
import { filterInUsersWithValidMatchingPicUrl, getMatchingPicUrlForUsers } from "./helper-fns/aws.js";
import moment from "moment";
import axios from 'axios'
import { cache, Cache } from "../../utils/cache.js";
import { DynamicKeyVal } from "../../types-and-interfaces/interfaces/globalInterfaces.js";
import { EXPIRATION_TIME_CACHED_MATCHES } from "../../globalVals.js";

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

async function getValidMatches(
    userQueryOpts: UserQueryOpts,
    currentUser: UserBaseModelSchema,
    currentValidUserMatches: UserBaseModelSchema[],
    idsOfUsersNotToShow: string[] = []
): Promise<IGetValidMatches> {
    let validMatchesToSendToClient: UserBaseModelSchema[] = currentValidUserMatches;
    let _userQueryOpts: UserQueryOpts = { ...userQueryOpts }
    console.log("_userQueryOpts: ", _userQueryOpts)
    let matchesPage = {} as IMatchesPagination;
    let _hasReachedPaginationEnd = false;

    try {
        let timeBeforeLoopMs = new Date().getTime();

        while (validMatchesToSendToClient.length < 5) {
            let loopTimeElapsed = new Date().getTime() - timeBeforeLoopMs;

            if (loopTimeElapsed > 10_000) {
                console.log('Time out has occurred.')
                matchesPage = {
                    hasReachedPaginationEnd: _hasReachedPaginationEnd,
                    canStillQueryCurrentPageForUsers: false,
                    validMatches: validMatchesToSendToClient,
                    didTimeOutOccur: true,
                    updatedSkipDocsNum: _userQueryOpts.skipDocsNum as number,
                }

                break;
            }

            const queryOptsForPagination = createQueryOptsForPagination(_userQueryOpts, currentUser, idsOfUsersNotToShow)
            const queryMatchesResults = await getMatches(queryOptsForPagination);
            const { hasReachedPaginationEnd, potentialMatches } = queryMatchesResults.data as InterfacePotentialMatchesPage;
            _hasReachedPaginationEnd = hasReachedPaginationEnd;

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
                    didErrorOccur: true,
                };
                break;
            }

            let matchesToSendToClient = potentialMatches?.length ? await filterInUsersWithValidMatchingPicUrl(potentialMatches) : [];
            console.log("matchesToSendToClient.length after filter: ", matchesToSendToClient.length)
            matchesToSendToClient = matchesToSendToClient.length ? await filterInUsersWithPrompts(matchesToSendToClient) : [];
            let usersToAddNum = 0;
            const matchesToSendToClientCopy = matchesToSendToClient.length ? structuredClone(matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum)) : []
            matchesToSendToClient = matchesToSendToClientCopy.length ? matchesToSendToClientCopy : [];

            if (matchesToSendToClient.length && (validMatchesToSendToClient.length !== 5)) {
                usersToAddNum = 5 - validMatchesToSendToClient.length
                matchesToSendToClient = matchesToSendToClient.slice(0, usersToAddNum);
                validMatchesToSendToClient.push(...matchesToSendToClient);
            }

            console.log("_userQueryOpts: ", _userQueryOpts.skipDocsNum)
            console.log('validMatchestoSendToClient: ', validMatchesToSendToClient)
            console.log("validMatchesToSendToClient.length: ", validMatchesToSendToClient.length)
            console.log('_hasReachedPaginationEnd: ', _hasReachedPaginationEnd);

            const _updatedSkipDocsNum = (typeof _userQueryOpts.skipDocsNum === 'string') ? parseInt(_userQueryOpts.skipDocsNum) : _userQueryOpts.skipDocsNum

            if ((validMatchesToSendToClient.length < 5) && !_hasReachedPaginationEnd) {
                _userQueryOpts = { ..._userQueryOpts, skipDocsNum: _updatedSkipDocsNum + 5 }
            }

            if (_hasReachedPaginationEnd || (validMatchesToSendToClient?.length >= 5)) {
                let validMatchesToSendToClientUpdated = (validMatchesToSendToClient?.length > 5) ? validMatchesToSendToClient.slice(0, 5) : validMatchesToSendToClient;
                matchesPage = {
                    hasReachedPaginationEnd: _hasReachedPaginationEnd,
                    validMatches: validMatchesToSendToClientUpdated,
                    updatedSkipDocsNum: _updatedSkipDocsNum
                }

                // if the usersToAddNum does not equal to 5, then the user can still query the current page for more users
                // or if the usersToAddNum does not equal the length of potentialMatches array minus one, then the current user can still query the current page for more users
                if (!_hasReachedPaginationEnd) {

                    console.log("usersToAddNum: ", usersToAddNum)

                    console.log("potentialMatches.length: ", potentialMatches.length)

                    const userIdsOfMatchesToCacheSliced = matchesToSendToClientCopy.slice(usersToAddNum, potentialMatches.length);
                    let userIdsOfMatchesToCache = userIdsOfMatchesToCacheSliced?.length ? userIdsOfMatchesToCacheSliced.map(({ _id }) => _id) : [];
                    matchesPage.canStillQueryCurrentPageForUsers = (usersToAddNum !== (potentialMatches.length - 1));

                    if (!matchesPage.canStillQueryCurrentPageForUsers) {
                        matchesPage.updatedSkipDocsNum = (_updatedSkipDocsNum as number) + 5;
                    }

                    const userIdsOfMatchesToShowForMatchesPgCache = cache.get("userIdsOfMatchesToShowForMatchesPg");

                    if ((userIdsOfMatchesToShowForMatchesPgCache as DynamicKeyVal<string[]>)?.[currentUser._id]?.length) {
                        const cachedUserIdsForCurrentUser = (userIdsOfMatchesToShowForMatchesPgCache as DynamicKeyVal<string[]>)[currentUser._id];
                        userIdsOfMatchesToCache = userIdsOfMatchesToCache?.length ? [...userIdsOfMatchesToCache, ...cachedUserIdsForCurrentUser] : cachedUserIdsForCurrentUser;
                    }

                    const result = cache.set("userIdsOfMatchesToShowForMatchesPg", { [currentUser._id]: userIdsOfMatchesToCache }, EXPIRATION_TIME_CACHED_MATCHES)

                    console.log('were queried users stored in cache: ', result)
                    const _matchesToShowForNextQuery = cache.get("userIdsOfMatchesToShowForMatchesPg");
                    console.log("_matchesToShowForNextQuery: ", _matchesToShowForNextQuery)
                }

                if (_hasReachedPaginationEnd) {
                    break;
                }
            }
        }

        console.log("Finished getting matches to display to the user on the clientside: ", matchesPage)

        console.log("validMatchesToSendToClient: ", validMatchesToSendToClient.length)

        return { page: matchesPage }
    } catch (error) {
        console.error('Failed to get valid matches. An error has occurred: ', error)

        return { didErrorOccur: true };
    }

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

    // for testing:
    // let skipAndLimitObj = { skip: 0, limit: 150 };
    // the above is for testing: 


    let skipAndLimitObj = { skip: skipDocsNum as number, limit: 5 };
    const returnVal = { skipAndLimitObj, paginationQueryOpts, currentPageNum };

    return returnVal;
}

async function queryForPotentialMatches(queryOptsForPagination: IQueryOptsForPagination): Promise<InterfacePotentialMatchesPage> {
    let { skipAndLimitObj, paginationQueryOpts, currentPageNum } = queryOptsForPagination;

    // BELOW, FOR TESTING:
    // skipAndLimitObj = { skip: 0, limit: 150 };
    // ABOVE, FOR TESTING:
    if (paginationQueryOpts?.location) {
        (Users as any).createIndexes([{ location: '2dsphere' }])
    }

    const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count()
    const potentialMatchesPromise = Users.find(paginationQueryOpts, null, skipAndLimitObj).sort({ ratingNum: 'desc' }).lean()
    let [totalUsersForQuery, potentialMatches]: [number, UserBaseModelSchema[]] = await Promise.all([totalUsersForQueryPromise, potentialMatchesPromise])
    const hasReachedPaginationEnd = (5 * currentPageNum) >= totalUsersForQuery;
    console.log('totalUsersForQuery: ', totalUsersForQuery)

    if (totalUsersForQuery === 0) {
        return { potentialMatches: [], hasReachedPaginationEnd: true }
    }


    if (hasReachedPaginationEnd) {
        return { potentialMatches: potentialMatches, hasReachedPaginationEnd: true }
    }

    return { potentialMatches: potentialMatches, hasReachedPaginationEnd: (5 * currentPageNum) >= totalUsersForQuery, totalUsersForQuery: totalUsersForQuery }
}

function getIdsOfUsersNotToShow(currentUserId: string, rejectedUsers: RejectedUserInterface[], allRecipientsOfChats: string[], idsOfUserMatchesReceivedOnClient?: string[]): string[] {
    const allRejectedUserIds = [
        ...new Set((rejectedUsers)
            .flatMap((rejectedUserInfo: RejectedUserInterface) => {
                return [rejectedUserInfo.rejectedUserId, rejectedUserInfo.rejectorUserId]
            })
            .filter(userId => currentUserId !== userId))
    ]

    if (idsOfUserMatchesReceivedOnClient?.length) {
        return [...allRejectedUserIds, ...allRecipientsOfChats, ...idsOfUserMatchesReceivedOnClient]
    }

    return [...allRejectedUserIds, ...allRecipientsOfChats];
}


async function getMatches(queryOptsForPagination: IQueryOptsForPagination): Promise<GetMatchesResult> {
    try {
        console.log('queryOptsForPagination, getMatches fn: ', queryOptsForPagination)
        const potentialMatchesPaginationObj = await queryForPotentialMatches(queryOptsForPagination);
        console.log("potentialMatchesPaginationObj.potentialMatches: ", potentialMatchesPaginationObj.potentialMatches);

        return {
            status: 200,
            data: potentialMatchesPaginationObj

        }
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

async function getLocationStr(userLocation: [number, number]): Promise<{ wasSuccessful: boolean, data?: string }> {
    try {
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
        const userLocationStrResult = await getLocationStr(userLocation.coordinates);

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


export { getMatches, createQueryOptsForPagination, getIdsOfUsersNotToShow, getPromptsAndMatchingPicForClient, getLocationStrForUsers, getLocationStr, getValidMatches }