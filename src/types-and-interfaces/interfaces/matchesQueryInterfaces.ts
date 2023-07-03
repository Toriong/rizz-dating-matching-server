import { UserBaseModelSchema } from "../../models/User.js";
import { PromptModelInterface } from "./promptsInterfaces.js";

interface InterfacePotentialMatchesPage {
    potentialMatches: UserBaseModelSchema[];
    updatedSkipDocsNum: string | number;
    canStillQueryCurrentPageForUsers: boolean;
    hasReachedPaginationEnd: boolean;
}

interface IFilterUserWithouPromptsReturnVal {
    potentialMatches: UserBaseModelSchema[];
    prompts: PromptModelInterface[];
    didErrorOccur?: boolean
}

export { InterfacePotentialMatchesPage, IFilterUserWithouPromptsReturnVal }