import axios from "axios";
import { Picture, UserBaseModelSchema } from "../../models/User.js";
import { InterfacePotentialMatchesPage, MatchesQueryPage, PotentialMatchesPageMap } from "../../types-and-interfaces/interfaces/matchesQueryInterfaces.js";
import { IUserAndPrompts, PromptInterface, PromptModelInterface } from "../../types-and-interfaces/interfaces/promptsInterfaces.js";
import { UserLocation, UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";
import { getPrompstByUserIds } from "../promptsServices/getPromptsServices.js";
import { getDoesImgAwsObjExist, getMatchPicUrl } from "./helper-fns/aws.js";
import { getMatches } from "./matchesQueryServices.js";
import dotenv from 'dotenv';


interface IFilterUserWithoutPromptsReturnVal {
    potentialMatches: UserBaseModelSchema[]
    prompts: PromptModelInterface[]
    matchesQueryPage?: MatchesQueryPage
    errMsg?: string
}

async function filterUsersWithoutPrompts(potentialMatches: UserBaseModelSchema[]): Promise<IFilterUserWithoutPromptsReturnVal> {
    try {
        const getPrompstByUserIdsResult = await getPrompstByUserIds(potentialMatches.map(({ _id }) => _id))
        const userPrompts = getPrompstByUserIdsResult.data as PromptModelInterface[];
        const userIdsOfPrompts = userPrompts.map(({ userId }) => userId)

        return {
            potentialMatches: potentialMatches.filter(({ _id }) => userIdsOfPrompts.includes(_id)),
            prompts: userPrompts
        }
    } catch (error) {
        console.error("An error has occurred in getting prompts and users: ", error)

        return { potentialMatches: [], prompts: [], }
    }
}

async function getUsersWithPrompts(userQueryOpts: UserQueryOpts, currentUserId: string, potentialMatches: UserBaseModelSchema[]): Promise<IFilterUserWithoutPromptsReturnVal> {
    try {
        const queryMatchesResults = await getMatches(userQueryOpts, currentUserId, potentialMatches);

        if ((queryMatchesResults.status !== 200) || !queryMatchesResults?.data || !queryMatchesResults?.data?.potentialMatches) {
            throw new Error("Failed to get matches.")
        }

        let usersAndPrompts: IFilterUserWithoutPromptsReturnVal = { potentialMatches: [], prompts: [] }
        const { canStillQueryCurrentPageForUsers, potentialMatches: getMatchesUsersResult, updatedSkipDocsNum, hasReachedPaginationEnd } = queryMatchesResults.data
        const filterUserWithoutPromptsResult = await filterUsersWithoutPrompts(getMatchesUsersResult);


        if ((filterUserWithoutPromptsResult?.potentialMatches?.length < 5) && !hasReachedPaginationEnd) {
            const updatedSkipDocNumInt = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum
            const _userQueryOpts: UserQueryOpts = { ...userQueryOpts, skipDocsNum: canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) }
            usersAndPrompts = await getUsersWithPrompts(_userQueryOpts, currentUserId, potentialMatches);
        }

        delete queryMatchesResults.data.potentialMatches

        return {
            ...usersAndPrompts,
            matchesQueryPage: queryMatchesResults.data
        };
    } catch (error: any) {
        console.error('An error has occurred in geting users with prompts: ', error)

        return { potentialMatches: [], prompts: [], errMsg: error.message }
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


type GetMatchesInfoForClientReturnVal = Promise<ReturnType<() => ({ potentialMatches: IUserAndPrompts[], usersWithValidUrlPics: UserBaseModelSchema[] })>>

async function getMatchesInfoForClient(potentialMatches: UserBaseModelSchema[], prompts: PromptModelInterface[]): GetMatchesInfoForClientReturnVal {
    console.log('Getting matches info for client, getting user info from db and aws.')
    let userInfoAndPromptsForClient: IUserAndPrompts[] = [];

    for (let numIteration = 0; numIteration < potentialMatches.length; numIteration++) {
        const { _id, name, hobbies, location, pics, looks } = potentialMatches[numIteration];
        const matchingPic = pics.find(({ isMatching }) => isMatching) as Picture;
        let matchingPicUrl: null | string = null;
        const doesMatchigPicUrlExist = await getDoesImgAwsObjExist(matchingPic.picFileNameOnAws);

        if (doesMatchigPicUrlExist) {
            const getMatchPicUrlResult = await getMatchPicUrl(matchingPic.picFileNameOnAws);
            matchingPicUrl = getMatchPicUrlResult.matchPicUrl as string;
        }

        const userPrompts = prompts.find(({ userId }) => userId === _id)

        if (!userPrompts || !matchingPicUrl) {
            continue;
        }

        console.log('Getting coordinates of user: ', location.coordinates)

        const { wasSuccessful, data: userLocationStr } = await getReverseGeoCode(location.coordinates);

        console.log('userLocationStr: ', userLocationStr)

        let userInfoAndPromptsObj: IUserAndPrompts = {
            _id: _id,
            firstName: name.first,
            prompts: userPrompts.prompts,
            matchingPicUrl: matchingPicUrl,
        }

        if (wasSuccessful) {
            userInfoAndPromptsObj.locationStr = userLocationStr as string;
        } else {
            userInfoAndPromptsObj.locationErrorMsg = "Unable to get user's location."
        }

        if (looks && hobbies) {
            userInfoAndPromptsObj = {
                ...userInfoAndPromptsObj,
                looks: looks,
                hobbies: hobbies
            }
            userInfoAndPromptsForClient.push(userInfoAndPromptsObj);
            continue;
        }

        if (looks) {
            userInfoAndPromptsObj = {
                ...userInfoAndPromptsObj,
                looks: looks
            }
            userInfoAndPromptsForClient.push(userInfoAndPromptsObj);
            continue;
        }

        userInfoAndPromptsForClient.push(userInfoAndPromptsObj);
    }

    return {
        potentialMatches: userInfoAndPromptsForClient,
        usersWithValidUrlPics: potentialMatches.filter(({ _id: userIdPotentialMatch }) => userInfoAndPromptsForClient.some(({ _id: userId }) => userId === userIdPotentialMatch))
    };
}

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


export { filterUsersWithoutPrompts, getUsersWithPrompts, getMatchesInfoForClient, getPromptsAndPicUrlsOfUsersAfterPicUrlRetrievalFailure }