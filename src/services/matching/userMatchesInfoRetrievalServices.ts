import { UserBaseModelSchema } from "../../models/User.js";
import { InterfacePotentialMatchesPage } from "../../types-and-interfaces/interfaces/matchesQueryInterfaces.js";
import { PromptInterface, PromptModelInterface } from "../../types-and-interfaces/interfaces/promptsInterfaces.js";
import { UserQueryOpts } from "../../types-and-interfaces/interfaces/userQueryInterfaces.js";
import { getPrompstByUserIds } from "../promptsServices/getPromptsServices.js";
import { getMatches } from "./matchesQueryServices.js";

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


export { filterUsersWithoutPrompts, getUsersWithPrompts }