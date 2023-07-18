import { UserBaseModelSchema, UserNames } from "../../models/User.js";
import { IUserAndPrompts, PromptInterface, PromptModelInterface } from "./promptsInterfaces.js";
import { UserLocation } from "./userQueryInterfaces.js";

interface InterfacePotentialMatchesPage {
    updatedSkipDocsNum: string | number;
    hasReachedPaginationEnd: boolean;
    canStillQueryCurrentPageForUsers?: boolean;
    potentialMatches?: UserBaseModelSchema[];
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


type TUser = Pick<UserBaseModelSchema, "_id" | "ratingNum" | "pics">;
type LocationErrorMsgStr = "Can't get user's location." | "Unable to get user's location."
interface IUserMatch extends TUser {
    prompts?: PromptInterface[]
    locationStr?: string
    matchingPicUrl?: string
    name?: UserNames
    locationErrorMsg?: LocationErrorMsgStr,
    firstName?: string,
    location?: UserLocation,
    // the first value is the latitude, the second is the longitude
    userLocationArr?: [number, number],
}

export { IUserMatch, InterfacePotentialMatchesPage, PotentialMatchesPaginationForClient, IFilterUserWithoutPromptsReturnVal, MatchesQueryPage, PotentialMatchesPageMap }