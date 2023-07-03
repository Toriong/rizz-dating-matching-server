import { UserBaseModelSchema } from "../../models/User.js";

interface InterfacePotentialMatchesPage {
    potentialMatches: UserBaseModelSchema[];
    updatedSkipDocsNum: string | number;
    canStillQueryCurrentPageForUsers: boolean;
    hasReachedPaginationEnd: boolean;
}

export { InterfacePotentialMatchesPage }