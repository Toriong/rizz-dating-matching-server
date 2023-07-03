var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getPrompstByUserIds } from "../promptsServices/getPromptsServices.js";
function filterUserWithoutPrompts(potentialMatches) {
    return __awaiter(this, void 0, void 0, function* () {
        // this function will get the user ids of the queried matches
        // using the ids of the users, get the prompts of the users
        // pass in the matches array for this function
        // using the userIds of the matches array, get the prompts of the users from the db
        // the results from the above is called, prompts 
        // filter out the users who do not have any prompts and return the results of the filter for this function
        const getPrompstByUserIdsResult = yield getPrompstByUserIds(potentialMatches.map(({ _id }) => _id));
        const userIdsOfPrompts = getPrompstByUserIdsResult.data.map(({ userId }) => userId);
        // filter through the potentialMaches, for each iteration, get the _id of the user, if the _id of the user is in the userIdsOfPrompts, then filter in that user. Else, filter out that user.
        return potentialMatches.filter(({ _id }) => userIdsOfPrompts.includes(_id));
    });
}
export { filterUserWithoutPrompts };
