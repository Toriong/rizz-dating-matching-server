import { User as Users, PaginationQueryingOpts, UserBaseModelSchema, UserLocation } from "../../models/User.js"
import { UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";
import { RejectedUserInterface } from "../../types-and-interfaces/interfaces/rejectedUserDocsInterfaces.js";
import { IGetValidMatches, IMatchesPagination, IUserMatch, InterfacePotentialMatchesPage } from "../../types-and-interfaces/interfaces/matchesQueryInterfaces.js";
import { filterInUsersWithPrompts, getMatchesWithPrompts } from "../promptsServices/getPromptsServices.js";
import { filterInUsersWithValidMatchingPicUrl, getMatchingPicUrlForUsers } from "./helper-fns/aws.js";
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

async function getValidMatches(userQueryOpts: UserQueryOpts, currentUser: UserBaseModelSchema, currentValidUserMatches: UserBaseModelSchema[], idsOfUsersNotToShow: string[] = []): Promise<IGetValidMatches> {
    let validMatchesToSendToClient: UserBaseModelSchema[] = [];
    let _userQueryOpts: UserQueryOpts = { ...userQueryOpts }
    let matchesPage = {} as IMatchesPagination;
    let _hasReachedPaginationEnd = false;

    try {
        let timeBeforeLoopMs = new Date().getTime();

        while (validMatchesToSendToClient.length < 5) {
            let loopTimeElapsed = new Date().getTime() - timeBeforeLoopMs;

            if (loopTimeElapsed > 15_000) {
                matchesPage = {
                    hasReachedPaginationEnd: _hasReachedPaginationEnd,
                    canStillQueryCurrentPageForUsers: false,
                    updatedSkipDocsNum: _userQueryOpts?.skipDocsNum as number,
                    validMatches: validMatchesToSendToClient,
                    didTimeOutOccur: true
                }
                break;
            }

            const queryOptsForPagination = createQueryOptsForPagination(_userQueryOpts, currentUser, idsOfUsersNotToShow)
            const queryMatchesResults = await getMatches(queryOptsForPagination, _userQueryOpts.skipDocsNum as number);
            const { hasReachedPaginationEnd, potentialMatches, updatedSkipDocsNum } = queryMatchesResults.data as InterfacePotentialMatchesPage;
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
                    didErrorOccur: true
                };
                break;
            }

            // GOAL: don't get six users in the total of users to be returned from this function

            let matchesToSendToClient = await filterInUsersWithValidMatchingPicUrl(potentialMatches)
            matchesToSendToClient = matchesToSendToClient.length ? await filterInUsersWithPrompts(matchesToSendToClient) : [];
            const endingSliceIndex = 5 - validMatchesToSendToClient.length;
            // after the slice, if the inverse of the slice is 0, then the current page can still be queried for users
            matchesToSendToClient = matchesToSendToClient.length ? matchesToSendToClient.sort((userA, userB) => userB.ratingNum - userA.ratingNum).slice(0, endingSliceIndex) : [];
            matchesToSendToClient = matchesToSendToClient.length ? [...matchesToSendToClient, ...currentValidUserMatches].sort((userA, userB) => userB.ratingNum - userA.ratingNum) : [];

            if (matchesToSendToClient.length) {
                console.log("validMatchesToSendToClient.length: ")
                console.log(validMatchesToSendToClient.length)

                console.log("matchesToSendToClient.length: ")
                console.log(matchesToSendToClient.length)
                
                validMatchesToSendToClient.push(...matchesToSendToClient);
            }

            let _updatedSkipDocsNum = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;

            if ((validMatchesToSendToClient.length < 5) && !_hasReachedPaginationEnd) {
                _updatedSkipDocsNum = _updatedSkipDocsNum + 5;
                _userQueryOpts = { ..._userQueryOpts, skipDocsNum: _updatedSkipDocsNum }
            }

            if (_hasReachedPaginationEnd || (validMatchesToSendToClient?.length >= 5)) {
                let validMatchesToSendToClientUpdated = (validMatchesToSendToClient?.length > 5) ? validMatchesToSendToClient.slice(0, 5) : validMatchesToSendToClient;
                matchesPage = {
                    hasReachedPaginationEnd: _hasReachedPaginationEnd,
                    validMatches: validMatchesToSendToClientUpdated,
                    updatedSkipDocsNum: _updatedSkipDocsNum,
                }

                // if the endingSliceIndex does not equal to 5, then the user can still query the current page for more users
                // or if the endingSliceIndex does not equal the length of potentialMatches array minus one, then the current user can still query the current page for more users
                if (!_hasReachedPaginationEnd) {
                    
                    console.log("endingSliceIndex: ", endingSliceIndex)

                    console.log("potentialMatches.length: ", potentialMatches.length)

                    const unshowableUserIds = potentialMatches.slice(endingSliceIndex, potentialMatches.length).map(({ _id }) => _id);

                    // put the users below into the cache, if necessary
                    console.log("unshowableUserIds: ", unshowableUserIds)

                    matchesPage['canStillQueryCurrentPageForUsers'] = (endingSliceIndex !== (potentialMatches.length - 1));

                    console.log("matchesPage['canStillQueryCurrentPageForUsers']: ", matchesPage['canStillQueryCurrentPageForUsers'])
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

    const totalUsersForQueryPromise = Users.find(paginationQueryOpts).sort({ ratingNum: 'desc' }).count()
    const potentialMatchesPromise = Users.find(paginationQueryOpts, null, skipAndLimitObj).sort({ ratingNum: 'desc' }).lean()
    let [totalUsersForQuery, potentialMatches]: [number, UserBaseModelSchema[]] = await Promise.all([totalUsersForQueryPromise, potentialMatchesPromise])
    const hasReachedPaginationEnd = (5 * currentPageNum) >= totalUsersForQuery;

    if (totalUsersForQuery === 0) {
        return { potentialMatches: [], updatedSkipDocsNum: 0, hasReachedPaginationEnd: true }
    }


    if (hasReachedPaginationEnd) {
        return { potentialMatches: potentialMatches, updatedSkipDocsNum, hasReachedPaginationEnd: true }
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

async function getLocationStr(userLocation: [number, number]): Promise<{ wasSuccessful: boolean, data?: string }> {
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


export { getMatches, createQueryOptsForPagination, getIdsOfUsersNotToShow, getPromptsAndMatchingPicForClient, getLocationStrForUsers, getValidMatches }