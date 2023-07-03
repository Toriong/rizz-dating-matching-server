import { UserBaseModelSchema } from "../../models/User.js";
import { PromptInterface, PromptModelInterface } from "../../types-and-interfaces/interfaces/promptsInterfaces.js";
import { getPrompstByUserIds } from "../promptsServices/getPromptsServices.js";


async function filterUserWithoutPrompts(potentialMatches: UserBaseModelSchema[]) {
    // this function will get the user ids of the queried matches
    // using the ids of the users, get the prompts of the users
    // pass in the matches array for this function
    // using the userIds of the matches array, get the prompts of the users from the db
    // the results from the above is called, prompts 
    // filter out the users who do not have any prompts and return the results of the filter for this function
    const getPrompstByUserIdsResult = await getPrompstByUserIds(potentialMatches.map(({ _id }) => _id))
    const userIdsOfPrompts = (getPrompstByUserIdsResult.data as PromptModelInterface[]).map(({ userId }) => userId)
    // filter through the potentialMaches, for each iteration, get the _id of the user, if the _id of the user is in the userIdsOfPrompts, then filter in that user. Else, filter out that user.
    return potentialMatches.filter(({ _id }) => userIdsOfPrompts.includes(_id))
}


export { filterUserWithoutPrompts }