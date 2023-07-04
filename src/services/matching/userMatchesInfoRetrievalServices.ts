import { Picture, UserBaseModelSchema } from "../../models/User.js";
import { InterfacePotentialMatchesPage } from "../../types-and-interfaces/interfaces/matchesQueryInterfaces.js";
import { IUserAndPrompts, PromptInterface, PromptModelInterface } from "../../types-and-interfaces/interfaces/promptsInterfaces.js";
import { UserLocation, UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";
import { getPrompstByUserIds } from "../promptsServices/getPromptsServices.js";
import { getMatchPicUrl } from "./helper-fns/aws.js";
import { getMatches } from "./matchesQueryServices.js";
import dotenv from 'dotenv';


interface IFilterUserWithouPromptsReturnVal {
    potentialMatches: UserBaseModelSchema[];
    prompts: PromptModelInterface[];
    didErrorOccur?: boolean
}

async function filterUsersWithoutPrompts(potentialMatches: UserBaseModelSchema[]): Promise<IFilterUserWithouPromptsReturnVal> {
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

        return { potentialMatches: [], prompts: [], didErrorOccur: true }
    }
}

async function getUsersWithPrompts(userQueryOpts: UserQueryOpts, currentUserId: string, potentialMatches: UserBaseModelSchema[]): Promise<IFilterUserWithouPromptsReturnVal> {
    try {
        // the below function will get the user of the next query if the current page has no valid users to display to the user in the front end
        const queryMatchesResults = await getMatches(userQueryOpts, currentUserId, potentialMatches);

        if (queryMatchesResults.status !== 200) {
            throw new Error("Failed to get matches.")
        }

        let usersAndPrompts: IFilterUserWithouPromptsReturnVal = { potentialMatches: [], prompts: [] }
        const { canStillQueryCurrentPageForUsers, potentialMatches: getMatchesUsersResult, updatedSkipDocsNum, hasReachedPaginationEnd } = (queryMatchesResults?.data as InterfacePotentialMatchesPage) ?? {}
        const filterUserWithoutPromptsResult = await filterUsersWithoutPrompts(getMatchesUsersResult);

        if ((filterUserWithoutPromptsResult?.potentialMatches?.length < 5) && !hasReachedPaginationEnd) {
            const updatedSkipDocNumInt = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum
            const _userQueryOpts: UserQueryOpts = { ...userQueryOpts, skipDocsNum: canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) }
            usersAndPrompts = await getUsersWithPrompts(_userQueryOpts, currentUserId, potentialMatches);
        }

        return usersAndPrompts;
    } catch (error) {
        console.error('An error has occurred in geting users with prompts: ', error)

        return { potentialMatches: [], prompts: [], didErrorOccur: true }
    }
}

async function getReverseGeoCode(coordinates: UserLocation) {
    try {
        dotenv.config();
        const { longitude, latitude } = coordinates;
        const openWeatherApiUrl = `http://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=5&appid=${process.env.OPEN_WEATHER_API_KEY}`
        const response = await fetch(openWeatherApiUrl);

        if (response.ok) {
            const data = await response.json();
            const { status, contents } = data;

            if ((status?.http_code === 400) || !data) {
                throw new Error('An error has occurred. Please refresh the page and try again.')
            };

            const locations = JSON.parse(contents);
            console.log('locations: ', locations)
            // return { _locations: locations?.length ? convertCountryCodesToNames(locations) : [] };
        };
    } catch (error) {
        if (error) {
            console.error('An error has occurred: ', error)
            return { didError: true, errorMsg: error }
        }
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



// GOAL: GET THE USER'S LOCATION BY REVERSE GEO LOCATION. 
async function getUserAndPromptInfoForClient(potentialMatches: UserBaseModelSchema[], prompts: PromptModelInterface[]): Promise<IUserAndPrompts[] | []> {
    let userInfoAndPromptsForClient: IUserAndPrompts[] = [];

    // CASE: all of the users don't have any images in the aws.
    // GOAL: call getUsersWithPrompts in order to get the valid users to display to the user on the client side. Those users must have a picture in aws for their matching pic.  


    // BRAIN DUMP: 
    // CASE: the target user doesn't have matching pic saved into the aws
    // GOAL: don't include that user into the userInfoandPromptsForClient array
    for (let numIteration = 0; numIteration < potentialMatches.length; numIteration++) {
        const { _id, name, hobbies, location, pics, looks } = potentialMatches[numIteration];
        const matchingPic = pics.find(({ isMatching }) => isMatching) as Picture;
        const getMatchPicUrlResult = await getMatchPicUrl(matchingPic.picFileNameOnAws);
        const userPrompts = prompts.find(({ userId }) => userId === _id)

        if (!userPrompts || (getMatchPicUrlResult.wasSuccessful === false)) {
            continue;
        }

        // GOAL: make an api call to get the city, state, and country of the user
        // if it fails to display: "Can't get user's location"

        if (looks && hobbies) {
            userInfoAndPromptsForClient.push({
                _id: _id,
                firstName: name.first,
                city: "",
                state: "",
                country: "",
                looks: looks,
                hobbies: hobbies,
                prompts: userPrompts.prompts,
                matchingPicUrl: getMatchPicUrlResult.matchPicUrl as string,
            })
            continue;
        }

        if (looks) {
            userInfoAndPromptsForClient.push({
                _id: _id,
                firstName: name.first,
                city: "",
                state: "",
                country: "",
                looks: looks,
                prompts: userPrompts.prompts,
                matchingPicUrl: getMatchPicUrlResult.matchPicUrl as string,
            })
            continue;
        }

        userInfoAndPromptsForClient.push({
            _id: _id,
            firstName: name.first,
            city: "",
            state: "",
            country: "",
            looks: looks,
            hobbies: hobbies,
            prompts: userPrompts.prompts,
            matchingPicUrl: getMatchPicUrlResult.matchPicUrl as string,
        })

    }

    return userInfoAndPromptsForClient;
}


export { filterUsersWithoutPrompts, getUsersWithPrompts }