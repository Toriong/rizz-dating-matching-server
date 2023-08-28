import { UserBaseModelSchema } from "../../models/User.js";

interface ReactionNumObjInterface {
    likesNum: number;
    neutralNum: number;
    dislikesNum: number;
}

interface PromptInterface {
    _id: string;
    prompt: string;
    answer: string;
    reactionNumObj: ReactionNumObjInterface
    isStory: boolean
}

interface PromptModelInterface {
    userId: string,
    prompts: PromptInterface[]
}

type UserPotentialMatchType = Pick<UserBaseModelSchema, "_id" | "bio" | "hobbies" | "looks">;
type UserFirstName = Pick<UserBaseModelSchema, "name">["name"]["first"];
type LocationErrorMsgStr = "Can't get user's location." | "Unable to get user's location."

interface IUserAndPrompts extends UserPotentialMatchType {
    _id: string,
    firstName: UserFirstName,
    locationStr?: string,
    ratingNum: number,
    matchingPicUrl: string,
    locationErrorMsg?: LocationErrorMsgStr,
    // the first value is the latitude, the second is the longitude
    userLocationArr?: [number, number],
    prompts: PromptInterface[]
}

export { ReactionNumObjInterface, PromptInterface, PromptModelInterface, IUserAndPrompts };