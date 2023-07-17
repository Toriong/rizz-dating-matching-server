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
            const promptDoc = yield Prompts.findOne({ userId: userId }).lean();
            if (!promptDoc) {
                throw new Error('Prompt document not found.');
            }
            return { wasSuccessful: true, data: promptDoc.prompts };
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
function getMatchesWithPrompts(users) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userIds = users.map(({ _id }) => _id);
            const getPromptsByUserIdsResult = yield getPrompstByUserIds(userIds);
            const usersWithPrompts = users.map(user => {
                const { name, _id } = user;
                const findPromptResultObj = getPromptsByUserIdsResult.data.find(({ userId }) => userId === _id);
                const _user = Object.assign(Object.assign({}, user), { firstName: name === null || name === void 0 ? void 0 : name.first, prompts: findPromptResultObj === null || findPromptResultObj === void 0 ? void 0 : findPromptResultObj.prompts });
                delete _user.name;
                return _user;
            });
            return { wasSuccessful: true, data: usersWithPrompts };
        }
        catch (error) {
            return { wasSuccessful: false, msg: 'An error has occurred in getting the prompts of the target users.' };
        }
    });
}
// create a function that will filter out users that don't have prompts in the database
// users are filter out of the given array since they don't have prompts in the database
// else, filter out the users that don't have prompts in the database
// if a prompt doc was received, then filter in the user
// for each user, using their id, get their prompt from the database 
// an array is attained with users, each user has the userBaseSchemaModal as their interface 
function filterInUsersWithPrompts(users) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let usersWithPrompts = [];
        console.log("getting prompts for users...");
        for (let numIteration = 0; numIteration < users.length; numIteration++) {
            const user = users[numIteration];
            const userPromptsResult = yield getPromptByUserId(user._id);
            if (userPromptsResult.wasSuccessful && ((_a = userPromptsResult.data) === null || _a === void 0 ? void 0 : _a.length)) {
                usersWithPrompts.push(user);
            }
        }
        console.log("usersWithPrompts.length: ", usersWithPrompts.length);
        return usersWithPrompts;
    });
}
export { getPromptByUserId, getPrompstByUserIds, filterInUsersWithPrompts, getMatchesWithPrompts };
