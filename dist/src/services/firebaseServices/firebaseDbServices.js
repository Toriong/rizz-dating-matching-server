var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import getFirebaseInfo from "./helper-fns/connectToFirebase.js";
function getChatUserById(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('getting chat user by id: ', userId);
            const { db, child, get, ref } = getFirebaseInfo();
            const chatUserDataSnapShot = yield get(child(ref(db), `userChatIds/${userId}`));
            if (!chatUserDataSnapShot.exists()) {
                throw new Error('The chat user does not exist in the firebase db.');
            }
            console.log('chatUserDataSnapShot.val(): ', chatUserDataSnapShot.val());
            return { wasSuccessful: true, data: chatUserDataSnapShot.val() };
        }
        catch (error) {
            console.error(`An error has occurred in getting the chat user from the database, id of user: ${userId}. Error message: `, error);
            return { wasSuccessful: false };
        }
    });
}
function getChatById(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { db, child, get, ref } = getFirebaseInfo();
            const chatDataSnapShot = yield get(child(ref(db), `1on1Chats/${chatId}`));
            if (!chatDataSnapShot.exists()) {
                throw new Error('The chat does not exist in the firebase db.');
            }
            return { wasSuccessful: true, data: chatDataSnapShot.val() };
        }
        catch (error) {
            const errorMsg = `An error has occurred in getting the chat from the database. Error message: ${error}`;
            console.error(errorMsg);
            return { wasSuccessful: false, msg: errorMsg };
        }
    });
}
function getAllUserChats(currentUserId) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("Getting thet chat id of the following user: ", currentUserId);
            const getChatUserByIdResult = yield getChatUserById(currentUserId);
            console.log('getChatUserByidResult: ', getChatUserByIdResult);
            if (!getChatUserByIdResult.wasSuccessful) {
                throw new Error('An error has occurred in getting the chat user from the database.');
            }
            if (!(getChatUserByIdResult === null || getChatUserByIdResult === void 0 ? void 0 : getChatUserByIdResult.data)) {
                throw new Error('The current user does not have chat object in the firebase database.');
            }
            const userChatIdsObj = getChatUserByIdResult.data;
            if (!((_a = userChatIdsObj === null || userChatIdsObj === void 0 ? void 0 : userChatIdsObj.chatIds) === null || _a === void 0 ? void 0 : _a.length)) {
                console.log('Theses users are not chatting with anybody.');
                return { wasSuccessful: true, data: [] };
            }
            const currentUserChatsPromises = userChatIdsObj.chatIds.map(chatId => getChatById(chatId));
            let currentUserChats = yield Promise.all(currentUserChatsPromises);
            currentUserChats = currentUserChats.filter(chat => chat.wasSuccessful).map(chat => chat.data);
            console.log('currentUserChats: ', currentUserChats);
            let chatUserRecipientIds = [
                ...new Set(currentUserChats
                    .flatMap(({ userIdA, userIdB }) => [userIdA, userIdB])
                    .filter(userId => currentUserId !== userId))
            ];
            console.log('The ids of the users that the current user is chatting with: ', chatUserRecipientIds);
            return { wasSuccessful: true, data: chatUserRecipientIds };
        }
        catch (error) {
            console.error('An error has occurred in getting the chat user from the firebase database. Error message: ', error.message || error);
            return { wasSuccessful: false };
        }
    });
}
export { getChatById, getChatUserById, getAllUserChats };
