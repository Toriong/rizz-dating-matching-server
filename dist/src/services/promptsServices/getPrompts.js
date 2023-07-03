var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import Prompts from "../../models/Prompt.js";
function getPromptByUserId(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const prompt = yield Prompts.findOne({ userId: userId }).lean();
            return { wasSuccessful: true, data: prompt };
        }
        catch (error) {
            console.error('An error has occurred in getting the prompt of the target user. Error: ', error);
            return { wasSuccessful: false, msg: 'An error has occurred in getting the prompt of the target user.' };
        }
    });
}
// create a function that will get the user's prompts from the database based on an array of userIds
function getPrompstByUserIds(userIds) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const prompts = yield Prompts.find({ userId: { $in: userIds } }).lean();
            return { wasSuccessful: true, data: prompts };
        }
        catch (error) {
            console.error('An error has occurred in getting the prompts of the target users. Error: ', error);
            return { wasSuccessful: false, msg: 'An error has occurred in getting the prompts of the target users.' };
        }
    });
}
export { getPromptByUserId, getPrompstByUserIds };
