import axios from "axios";
import { Picture, UserBaseModelSchema } from "../../models/User.js";
import { InterfacePotentialMatchesPage, MatchesQueryPage, PotentialMatchesPageMap } from "../../types-and-interfaces/interfaces/matchesQueryInterfaces.js";
import { IUserAndPrompts, PromptInterface, PromptModelInterface } from "../../types-and-interfaces/interfaces/promptsInterfaces.js";
import { UserLocation, UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";
import { getPrompstByUserIds } from "../promptsServices/getPromptsServices.js";
import { getMatchPicUrl } from "./helper-fns/aws.js";
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

// this function will update the how many docuements to skip, get that number
async function getUsersWithPrompts(userQueryOpts: UserQueryOpts, currentUserId: string, potentialMatches: UserBaseModelSchema[]): Promise<IFilterUserWithoutPromptsReturnVal> {
    try {
        // the below function will get the user of the next query if the current page has no valid users to display to the user in the front end
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

async function getReverseGeoCode(userLocation: UserLocation): Promise<{ wasSuccessful: boolean, data?: string }> {
    try {
        dotenv.config();
        const { longitude, latitude } = userLocation;
        const openWeatherApiUrl = `http://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=5&appid=${process.env.OPEN_WEATHER_API_KEY}`
        const response = await axios.get(openWeatherApiUrl);
        const { status, data } = response;

        if (status === 200) {
            throw new Error("Failed to get reverse geocode.")
        };

        const { city, state, country } = data[0];
        const countryName = getCountryName(country);

        if (!countryName) {
            throw new Error("Failed to get country name.")
        }

        const userLocationStr = state ? `${city}, ${state}, ${countryName}` : `${city}, ${countryName}`

        return { wasSuccessful: true, data: userLocationStr }
    } catch (error) {
        return { wasSuccessful: false }
    }
}


// GOAL: an array is created with each value being an object with the form of IUserAndPrompts
// an array with each object that has the form of IUserAndPrompts is returned from this function
// access the prompts array from the object that was attained from the prompts array
// the target prompt is attained from the prompts array
// using the id of the user, get their respective prompt from the prompts array 
// the picture url for each users is attained from aws and added to the user object by passing the path for the picture file to the function of getMatchPicUrl
// the picture file name is attained from the user object
// the following fields are abstracted from the user object: _id, hobbies, bio, name.firstName, location
// loop through the matches array, and for each user, get the above values:  
// matches array is passed as an argument
// the prompts array is passed as an argument
// the function getUserAndPromptInfoForClient is called with the matches array and prompts array as arguments

type GetMatchesInfoForClientReturnVal = Promise<ReturnType<() => ({ potentialMatches: IUserAndPrompts[], usersWithValidUrlPics: UserBaseModelSchema[] })>>

async function getMatchesInfoForClient(potentialMatches: UserBaseModelSchema[], prompts: PromptModelInterface[]): GetMatchesInfoForClientReturnVal {
    let userInfoAndPromptsForClient: IUserAndPrompts[] = [];

    for (let numIteration = 0; numIteration < potentialMatches.length; numIteration++) {
        const { _id, name, hobbies, location, pics, looks } = potentialMatches[numIteration];
        const matchingPic = pics.find(({ isMatching }) => isMatching) as Picture;
        const getMatchPicUrlResult = await getMatchPicUrl(matchingPic.picFileNameOnAws);
        const userPrompts = prompts.find(({ userId }) => userId === _id)

        if (!userPrompts || !getMatchPicUrlResult.wasSuccessful) {
            continue;
        }

        const { wasSuccessful, data: userLocationStr } = await getReverseGeoCode(location);
        let userInfoAndPromptsObj: IUserAndPrompts = {
            _id: _id,
            firstName: name.first,
            prompts: userPrompts.prompts,
            matchingPicUrl: getMatchPicUrlResult.matchPicUrl as string,
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


export { filterUsersWithoutPrompts, getUsersWithPrompts, getMatchesInfoForClient }