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
import { getMatches } from "./matchesQueryServices.js";
function filterUsersWithoutPrompts(potentialMatches) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const getPrompstByUserIdsResult = yield getPrompstByUserIds(potentialMatches.map(({ _id }) => _id));
            const userPrompts = getPrompstByUserIdsResult.data;
            const userIdsOfPrompts = userPrompts.map(({ userId }) => userId);
            return {
                potentialMatches: potentialMatches.filter(({ _id }) => userIdsOfPrompts.includes(_id)),
                prompts: userPrompts
            };
        }
        catch (error) {
            console.error("An error has occurred in getting prompts and users: ", error);
            return { potentialMatches: [], prompts: [], didErrorOccur: true };
        }
    });
}
function getUsersWithPrompts(userQueryOpts, currentUserId, potentialMatches) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const queryMatchesResults = yield getMatches(userQueryOpts, currentUserId, potentialMatches);
            if (queryMatchesResults.status !== 200) {
                throw new Error("Failed to get matches.");
            }
            let usersAndPrompts = { potentialMatches: [], prompts: [] };
            const { canStillQueryCurrentPageForUsers, potentialMatches: getMatchesUsersResult, updatedSkipDocsNum, hasReachedPaginationEnd } = (_a = queryMatchesResults === null || queryMatchesResults === void 0 ? void 0 : queryMatchesResults.data) !== null && _a !== void 0 ? _a : {};
            const filterUserWithoutPromptsResult = yield filterUsersWithoutPrompts(getMatchesUsersResult);
            if ((((_b = filterUserWithoutPromptsResult === null || filterUserWithoutPromptsResult === void 0 ? void 0 : filterUserWithoutPromptsResult.potentialMatches) === null || _b === void 0 ? void 0 : _b.length) < 5) && !hasReachedPaginationEnd) {
                const updatedSkipDocNumInt = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;
                const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) });
                usersAndPrompts = yield getUsersWithPrompts(_userQueryOpts, currentUserId, potentialMatches);
            }
            return usersAndPrompts;
        }
        catch (error) {
            console.error('An error has occurred in geting users with prompts: ', error);
            return { potentialMatches: [], prompts: [], didErrorOccur: true };
        }
    });
}
export { filterUsersWithoutPrompts, getUsersWithPrompts };
