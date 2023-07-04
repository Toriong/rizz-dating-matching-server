import { UserBaseModelSchema } from "../../models/User.js";
import { PromptModelInterface } from "./promptsInterfaces.js";

interface InterfacePotentialMatchesPage {
    potentialMatches?: UserBaseModelSchema[];
    updatedSkipDocsNum: string | number;
    canStillQueryCurrentPageForUsers: boolean;
    hasReachedPaginationEnd: boolean;
}

type MatchesQueryPage = Omit<InterfacePotentialMatchesPage, "potentialMatches">
type KeysPotentialMatchesPageMap = keyof InterfacePotentialMatchesPage
type PotentialMatchesPageMap = Record<KeysPotentialMatchesPageMap, InterfacePotentialMatchesPage[keyof MatchesQueryPage]>

interface IFilterUserWithouPromptsReturnVal {
    potentialMatches: UserBaseModelSchema[];
    prompts: PromptModelInterface[];
    didErrorOccur?: boolean
}



export { InterfacePotentialMatchesPage, IFilterUserWithouPromptsReturnVal, MatchesQueryPage, PotentialMatchesPageMap }