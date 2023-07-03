import Mongoose, { model } from 'mongoose';
import { PromptModelInterface, PromptInterface, ReactionNumObjInterface } from '../types-and-interfaces/interfaces/promptsInterfaces.js';

const { Schema } = Mongoose;
const ReactionNumObjSchema = new Schema<ReactionNumObjInterface>({
    likesNum: Number,
    neutralNum: Number,
    dislikesNum: Number
})
const PromptElementSchema = new Schema<PromptInterface>({
    prompt: String,
    answer: String,
    reactionNumObj: ReactionNumObjSchema
})
const PromptSchema = new Schema<PromptModelInterface>({
    // the _id will be the user's id
    userId: String,
    prompts: [PromptElementSchema]
})
const Prompt = model<PromptModelInterface>('Prompts', PromptSchema);

export default Prompt