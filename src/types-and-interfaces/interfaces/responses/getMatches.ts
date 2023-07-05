import { UserBaseModelSchema } from "../../../models/User.js";
import { InterfacePotentialMatchesPage, PotentialMatchesPaginationForClient } from "../matchesQueryInterfaces.js";
import { IUserAndPrompts } from "../promptsInterfaces.js";

interface MatchesQueryResponseBody {
    potentialMatchesPagination: PotentialMatchesPaginationForClient
}

interface IPotentialMatchesPaginationBuild extends Omit<InterfacePotentialMatchesPage, "potentialMatches"> {
    potentialMatches: UserBaseModelSchema[] | IUserAndPrompts[]
}

interface MatchesQueryRespsonseBodyBuild {
    potentialMatchesPagination: IPotentialMatchesPaginationBuild
}


export { MatchesQueryResponseBody, MatchesQueryRespsonseBodyBuild }