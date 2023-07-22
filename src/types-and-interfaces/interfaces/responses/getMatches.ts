import { UserBaseModelSchema } from "../../../models/User.js";
import { IMatchingPicUser } from "../../../services/matching/helper-fns/aws.js";
import { IMatchesPagination, InterfacePotentialMatchesPage, PotentialMatchesPaginationForClient } from "../matchesQueryInterfaces.js";
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
type TResponseBodyGetMatches = Omit<IMatchesPagination, 'validMatches'>
interface IResponseBodyGetMatches extends TResponseBodyGetMatches {
    potentialMatches?: IMatchingPicUser[]
}


export { MatchesQueryResponseBody, MatchesQueryRespsonseBodyBuild, IResponseBodyGetMatches }