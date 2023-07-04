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
import { getMatchPicUrl } from "./helper-fns/aws.js";
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
            // the below function will get the user of the next query if the current page has no valid users to display to the user in the front end
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
// GOAL: an array is created with each value being an object with the form of IUserAndPrompts
// an array with each object that has the form of IUserAndPrompts is returned from this function
// access the prompts array from the object that was attained from the prompts array
// the target prompt is attained from the prompts array
// using the id of the user, get their respective prompt from the prompts array 
// the picture url for each users is attained from aws and added to the user object by passing the path for the picture file to the function of getMatchPicUrl
// the picture file name is attained from the user object
// the following fields are abstracted from the user object: _id, hobbies, bio, name.firstName, location
// loop through the matches array, and for each user, get the above values:  
// matches array is passed as an argument
// the prompts array is passed as an argument
// the function getUserAndPromptInfoForClient is called with the matches array and prompts array as arguments
// GOAL: GET THE USER'S LOCATION BY REVERSE GEO LOCATION. 
function getUserAndPromptInfoForClient(potentialMatches, prompts) {
    return __awaiter(this, void 0, void 0, function* () {
        let userInfoAndPromptsForClient = [];
        // CASE: all of the users don't have any images in the aws.
        // GOAL: call getUsersWithPrompts in order to get the valid users to display to the user on the client side. Those users must have a picture in aws for their matching pic.  
        // BRAIN DUMP: 
        // CASE: the target user doesn't have matching pic saved into the aws
        // GOAL: don't include that user into the userInfoandPromptsForClient array
        for (let numIteration = 0; numIteration < potentialMatches.length; numIteration++) {
            const { _id, name, hobbies, location, pics, looks } = potentialMatches[numIteration];
            const matchingPic = pics.find(({ isMatching }) => isMatching);
            const getMatchPicUrlResult = yield getMatchPicUrl(matchingPic.picFileNameOnAws);
            const userPrompts = prompts.find(({ userId }) => userId === _id);
            if (!userPrompts || (getMatchPicUrlResult.wasSuccessful === false)) {
                continue;
            }
            // GOAL: make an api call to get the city, state, and country of the user
            // if it fails to display: "Can't get user's location"
            if (looks && hobbies) {
                userInfoAndPromptsForClient.push({
                    _id: _id,
                    firstName: name.first,
                    city: "",
                    state: "",
                    country: "",
                    looks: looks,
                    hobbies: hobbies,
                    prompts: userPrompts.prompts,
                    matchingPicUrl: getMatchPicUrlResult.matchPicUrl,
                });
                continue;
            }
            if (looks) {
                userInfoAndPromptsForClient.push({
                    _id: _id,
                    firstName: name.first,
                    city: "",
                    state: "",
                    country: "",
                    looks: looks,
                    prompts: userPrompts.prompts,
                    matchingPicUrl: getMatchPicUrlResult.matchPicUrl,
                });
                continue;
            }
            userInfoAndPromptsForClient.push({
                _id: _id,
                firstName: name.first,
                city: "",
                state: "",
                country: "",
                looks: looks,
                hobbies: hobbies,
                prompts: userPrompts.prompts,
                matchingPicUrl: getMatchPicUrlResult.matchPicUrl,
            });
        }
        return userInfoAndPromptsForClient;
    });
}
export { filterUsersWithoutPrompts, getUsersWithPrompts };
