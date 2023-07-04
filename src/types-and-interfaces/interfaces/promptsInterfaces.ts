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
}

interface PromptModelInterface {
    userId: string,
    prompts: PromptInterface[]
}

type UserPotentialMatchType = Pick<UserBaseModelSchema, "_id" | "bio" | "hobbies" | "looks">;
type UserFirstName = Pick<UserBaseModelSchema, "name">["name"]["first"];
type LocationErrorMsgStr = "Can't get user's location." | "Unable to get user's location."

interface IUserAndPrompts extends UserPotentialMatchType {
    firstName: UserFirstName,
    locationStr?: string,
    matchingPicUrl?: string,
    locationErrorMsg?: LocationErrorMsgStr,
    prompts: PromptInterface[]
}

export { ReactionNumObjInterface, PromptInterface, PromptModelInterface, IUserAndPrompts };