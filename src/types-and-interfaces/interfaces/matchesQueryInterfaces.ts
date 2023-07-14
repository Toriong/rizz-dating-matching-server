import { UserBaseModelSchema } from "../../models/User.js";
import { IUserAndPrompts, PromptModelInterface } from "./promptsInterfaces.js";

interface InterfacePotentialMatchesPage {
    potentialMatches?: UserBaseModelSchema[];
    updatedSkipDocsNum: string | number;
    canStillQueryCurrentPageForUsers: boolean;
    hasReachedPaginationEnd: boolean;
}
interface PotentialMatchesPaginationForClient extends Omit<InterfacePotentialMatchesPage, "potentialMatches"> {
    potentialMatches: IUserAndPrompts[]
}
type MatchesQueryPage = Omit<InterfacePotentialMatchesPage, "potentialMatches">
type KeysPotentialMatchesPageMap = keyof InterfacePotentialMatchesPage
type PotentialMatchesPageMap = Record<KeysPotentialMatchesPageMap, InterfacePotentialMatchesPage[keyof MatchesQueryPage]>
interface IFilterUserWithoutPromptsReturnVal {
    potentialMatches: UserBaseModelSchema[];
    prompts: PromptModelInterface[];
    errorMsg?: string
}

export { InterfacePotentialMatchesPage, PotentialMatchesPaginationForClient, IFilterUserWithoutPromptsReturnVal, MatchesQueryPage, PotentialMatchesPageMap }