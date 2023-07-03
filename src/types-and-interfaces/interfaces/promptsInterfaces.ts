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

interface PromptSchemaInterface {
    // put the id of the user for _id field
    userId: string,
    prompts: PromptInterface[]
}

interface CRUDResults{
    status: number,
    msg?: string,
    data?: PromptInterface | unknown
}

export { ReactionNumObjInterface, PromptInterface, PromptSchemaInterface, CRUDResults };