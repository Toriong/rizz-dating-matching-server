var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import axios from "axios";
import { getPrompstByUserIds } from "../promptsServices/getPromptsServices.js";
import { getDoesImgAwsObjExist, getMatchPicUrl } from "./helper-fns/aws.js";
import { getMatches } from "./matchesQueryServices.js";
import dotenv from 'dotenv';
function filterUsersWithoutPrompts(potentialMatches) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userIds = potentialMatches.map(({ _id }) => _id);
            const getPrompstByUserIdsResult = yield getPrompstByUserIds(userIds);
            const userPrompts = getPrompstByUserIdsResult.data;
            console.log('userPrompts filterUserWithoutPrompts: ', userPrompts);
            const userIdsOfPrompts = userPrompts.map(({ userId }) => userId);
            const potentialMatchesUpdated = potentialMatches.filter(({ _id }) => userIdsOfPrompts.includes(_id));
            console.log("potentialMatchesUpdated: ", potentialMatchesUpdated);
            return {
                potentialMatches: potentialMatchesUpdated,
                prompts: userPrompts
            };
        }
        catch (error) {
            console.error("An error has occurred in getting prompts and users: ", error);
            return { potentialMatches: [], prompts: [], };
        }
    });
}
// BRAIN DUMP:
// bug is occurring below 
// when a user doesn't have valid url pics nor valid prompts, this function is executed in order to get more users
// this function is getting user with prompts 
// should a return a non empty array
// bug is occurring in filterUsersWithoutPrompts function
function getUsersWithPrompts(userQueryOpts, currentUserId, potentialMatches) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const queryMatchesResults = yield getMatches(userQueryOpts, currentUserId, potentialMatches);
            if ((queryMatchesResults.status !== 200) || !(queryMatchesResults === null || queryMatchesResults === void 0 ? void 0 : queryMatchesResults.data) || !((_a = queryMatchesResults === null || queryMatchesResults === void 0 ? void 0 : queryMatchesResults.data) === null || _a === void 0 ? void 0 : _a.potentialMatches)) {
                throw new Error("Failed to get matches.");
            }
            let usersAndPrompts = { potentialMatches: [], prompts: [] };
            const { canStillQueryCurrentPageForUsers, potentialMatches: getMatchesUsersResult, updatedSkipDocsNum, hasReachedPaginationEnd } = queryMatchesResults.data;
            console.log("getMatchesUsersResult: ", getMatchesUsersResult);
            const filterUserWithoutPromptsResult = yield filterUsersWithoutPrompts(getMatchesUsersResult);
            if ((((_b = filterUserWithoutPromptsResult === null || filterUserWithoutPromptsResult === void 0 ? void 0 : filterUserWithoutPromptsResult.potentialMatches) === null || _b === void 0 ? void 0 : _b.length) < 5) && !hasReachedPaginationEnd) {
                console.log('At least one user does not have any prompts. Getting more users.');
                const updatedSkipDocNumInt = (typeof updatedSkipDocsNum === 'string') ? parseInt(updatedSkipDocsNum) : updatedSkipDocsNum;
                const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: canStillQueryCurrentPageForUsers ? updatedSkipDocNumInt : (updatedSkipDocNumInt + 5) });
                usersAndPrompts = yield getUsersWithPrompts(_userQueryOpts, currentUserId, potentialMatches);
            }
            if (((_c = filterUserWithoutPromptsResult === null || filterUserWithoutPromptsResult === void 0 ? void 0 : filterUserWithoutPromptsResult.potentialMatches) === null || _c === void 0 ? void 0 : _c.length) === 5) {
                usersAndPrompts = { potentialMatches: filterUserWithoutPromptsResult === null || filterUserWithoutPromptsResult === void 0 ? void 0 : filterUserWithoutPromptsResult.potentialMatches, prompts: filterUserWithoutPromptsResult.prompts };
            }
            delete queryMatchesResults.data.potentialMatches;
            return Object.assign(Object.assign({}, usersAndPrompts), { matchesQueryPage: queryMatchesResults.data });
        }
        catch (error) {
            console.error('An error has occurred in geting users with prompts: ', error);
            return { potentialMatches: [], prompts: [], errMsg: error.message };
        }
    });
}
function getCountryName(countryCode) {
    let regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(countryCode);
}
function getReverseGeoCode(userLocation) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            dotenv.config();
            const [longitude, latitude] = userLocation;
            const reverseGeoCodeUrl = `http://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=5&appid=${process.env.REVERSE_GEO_LOCATION_API_KEY}`;
            const response = yield axios.get(reverseGeoCodeUrl);
            const { status, data } = response;
            if (status !== 200) {
                throw new Error("Failed to get reverse geocode.");
            }
            ;
            console.log('Recevied reverse geo code data: ', data === null || data === void 0 ? void 0 : data[0]);
            const { name: city, state, country } = data[0];
            const countryName = getCountryName(country);
            if (!countryName) {
                throw new Error("Failed to get country name.");
            }
            const userLocationStr = state ? `${city}, ${state}, ${countryName}` : `${city}, ${countryName}`;
            return { wasSuccessful: true, data: userLocationStr };
        }
        catch (error) {
            console.error("Failed to get the reverse geocode of the user's location. Error message: ", error);
            return { wasSuccessful: false };
        }
    });
}
function getPromptsImgUrlsAndUserInfo(potentialMatches, prompts) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Getting matches info for client, getting user info from db and aws.');
        let userInfoAndPromptsForClient = [];
        for (let numIteration = 0; numIteration < potentialMatches.length; numIteration++) {
            const { _id, name, hobbies, location, pics, looks } = potentialMatches[numIteration];
            const matchingPic = pics.find(({ isMatching }) => isMatching);
            let matchingPicUrl = null;
            const doesMatchingPicUrlExist = yield getDoesImgAwsObjExist(matchingPic.picFileNameOnAws);
            console.log("doesMatchingPicUrlExist: ", doesMatchingPicUrlExist);
            if (doesMatchingPicUrlExist) {
                const getMatchPicUrlResult = yield getMatchPicUrl(matchingPic.picFileNameOnAws);
                matchingPicUrl = getMatchPicUrlResult.matchPicUrl;
            }
            const userPrompts = prompts.find(({ userId }) => userId === _id);
            if (!matchingPicUrl) {
                continue;
            }
            if (!userPrompts) {
                continue;
            }
            console.log('Getting coordinates of user: ', location.coordinates);
            const { wasSuccessful, data: userLocationStr } = yield getReverseGeoCode(location.coordinates);
            console.log('userLocationStr: ', userLocationStr);
            let userInfoAndPromptsObj = {
                _id: _id,
                firstName: name.first,
                prompts: userPrompts.prompts,
                matchingPicUrl: matchingPicUrl,
            };
            if (wasSuccessful) {
                userInfoAndPromptsObj.locationStr = userLocationStr;
            }
            else {
                userInfoAndPromptsObj.locationErrorMsg = "Unable to get user's location.";
            }
            if (looks && hobbies) {
                userInfoAndPromptsObj = Object.assign(Object.assign({}, userInfoAndPromptsObj), { looks: looks, hobbies: hobbies });
                userInfoAndPromptsForClient.push(userInfoAndPromptsObj);
                continue;
            }
            if (looks) {
                userInfoAndPromptsObj = Object.assign(Object.assign({}, userInfoAndPromptsObj), { looks: looks });
                userInfoAndPromptsForClient.push(userInfoAndPromptsObj);
                continue;
            }
            userInfoAndPromptsForClient.push(userInfoAndPromptsObj);
        }
        // BRAIN DUMP:
        // if at least one user does not have a valid matching url pic, then userInfoAndPromptsForClient will be less than 5. 
        // what is sending back to the user is an empty array even though the some users has valid url pics 
        console.log("userInfoAndPromptsForClient length: ", userInfoAndPromptsForClient.length);
        console.log('userInfoAndPromptsForClient: ', userInfoAndPromptsForClient);
        return {
            potentialMatches: userInfoAndPromptsForClient,
            usersWithValidUrlPics: potentialMatches.filter(({ _id: userIdPotentialMatch }) => userInfoAndPromptsForClient.some(({ _id: userId }) => userId === userIdPotentialMatch))
        };
    });
}
function getPromptsAndPicUrlsOfUsersAfterPicUrlOrPromptsRetrievalHasFailed(userQueryOpts, currentUserId, potentialMatches) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("userQueryOpts: ", userQueryOpts);
            console.log("potentialMatches: ", potentialMatches);
            const getUsersWithPromptsResult = yield getUsersWithPrompts(userQueryOpts, currentUserId, potentialMatches);
            console.log("getUsersWithPromptsResult.potentialMatches: ", getUsersWithPromptsResult.potentialMatches);
            if (getUsersWithPromptsResult.errMsg) {
                throw new Error(`An error has occurred in getting users with prompts. Error msg: ${getUsersWithPromptsResult.errMsg}`);
            }
            if (!getUsersWithPromptsResult.matchesQueryPage) {
                throw new Error("Something went wrong. Couldn't get the matches qeury page object.");
            }
            const getPromptsImgsUrlsAndUserInfoResult = yield getPromptsImgUrlsAndUserInfo(getUsersWithPromptsResult.potentialMatches, getUsersWithPromptsResult.prompts);
            const { potentialMatches: updatedPotentialMatches, usersWithValidUrlPics: updatedQueriedUsers } = getPromptsImgsUrlsAndUserInfoResult;
            const { hasReachedPaginationEnd, canStillQueryCurrentPageForUsers, updatedSkipDocsNum } = getUsersWithPromptsResult.matchesQueryPage;
            let potentialMatchesPaginationObj = { potentialMatches: updatedPotentialMatches, matchesQueryPage: getUsersWithPromptsResult.matchesQueryPage };
            if ((updatedPotentialMatches.length < 5) && canStillQueryCurrentPageForUsers && !hasReachedPaginationEnd) {
                console.log("updatedPotentialMatches is less than 5. At least one of the users do not have a valid url pic nor prompts.");
                const _userQueryOpts = Object.assign(Object.assign({}, userQueryOpts), { skipDocsNum: updatedSkipDocsNum });
                const getUsersWithPromptsAndPicUrlsResult = yield getPromptsAndPicUrlsOfUsersAfterPicUrlOrPromptsRetrievalHasFailed(_userQueryOpts, currentUserId, updatedQueriedUsers);
                if (getUsersWithPromptsAndPicUrlsResult.errorMsg) {
                    throw new Error(getUsersWithPromptsAndPicUrlsResult.errorMsg);
                }
                if (!getUsersWithPromptsAndPicUrlsResult.potentialMatches) {
                    throw new Error("Something went wrong. Couldn't get the potential matches array.");
                }
                if (!getUsersWithPromptsAndPicUrlsResult.matchesQueryPage) {
                    throw new Error("Something went wrong. Couldn't get the matches qeury page object.");
                }
                potentialMatchesPaginationObj.potentialMatches = getUsersWithPromptsAndPicUrlsResult.potentialMatches;
                potentialMatchesPaginationObj.matchesQueryPage = getUsersWithPromptsAndPicUrlsResult.matchesQueryPage;
            }
            return potentialMatchesPaginationObj;
        }
        catch (error) {
            const errorMsg = `An error has occurred in getting more users with prompts and pic urls for the user on the client side. Error: ${error}`;
            console.error(errorMsg);
            return { errorMsg: errorMsg };
        }
    });
}
export { filterUsersWithoutPrompts, getUsersWithPrompts, getPromptsImgUrlsAndUserInfo, getPromptsAndPicUrlsOfUsersAfterPicUrlOrPromptsRetrievalHasFailed };
