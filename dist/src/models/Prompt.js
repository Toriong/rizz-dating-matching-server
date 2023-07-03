import Mongoose, { model } from 'mongoose';
const { Schema } = Mongoose;
const ReactionNumObjSchema = new Schema({
    likesNum: Number,
    neutralNum: Number,
    dislikesNum: Number
});
const PromptElementSchema = new Schema({
    prompt: String,
    answer: String,
    reactionNumObj: ReactionNumObjSchema
});
const PromptSchema = new Schema({
    // the _id will be the user's id
    userId: String,
    prompts: [PromptElementSchema]
});
const Prompt = model('Prompts', PromptSchema);
export default Prompt;
