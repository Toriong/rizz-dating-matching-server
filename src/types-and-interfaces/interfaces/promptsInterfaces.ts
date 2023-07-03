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

type UserPotentialMatchType = Pick<UserBaseModelSchema, "_id" | "bio" | "hobbies">;
type UserFirstName = Pick<UserBaseModelSchema, "name">["name"]["first"];

interface IUserAndPrompts extends UserPotentialMatchType {
    firstName: UserFirstName,
    city?: string,
    state?: string | undefined,
    country?: string,
    matchingPicUrl?: string,
    prompts: PromptInterface[]
}

export { ReactionNumObjInterface, PromptInterface, PromptModelInterface, IUserAndPrompts };