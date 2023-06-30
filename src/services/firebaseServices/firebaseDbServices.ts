import getFirebaseInfo from "./helper-fns/connectToFirebase.js";
import { CRUDResult } from "../../types-and-interfaces/interfaces/globalInterfaces.js";
import { ChatInterface, UserChatIdsInterface } from "../../types-and-interfaces/interfaces/firebaseInterfaces.js";

async function getChatUserById(userId: string): Promise<CRUDResult> {
    try {
        console.log('getting chat user by id: ', userId)
        const { db, child, get, ref } = getFirebaseInfo();
        const chatUserDataSnapShot = await get(child(ref(db), `userChatIds/${userId}`))

        if (!chatUserDataSnapShot.exists()) {
            throw new Error('The chat user does not exist in the firebase db.')
        }

        console.log('chatUserDataSnapShot.val(): ', chatUserDataSnapShot.val())

        return { wasSuccessful: true, data: chatUserDataSnapShot.val() }
    } catch (error) {
        console.error(`An error has occurred in getting the chat user from the database, id of user: ${userId}. Error message: `, error)

        return { wasSuccessful: false }
    }
}

async function getChatById(chatId: String): Promise<CRUDResult> {
    try {
        const { db, child, get, ref } = getFirebaseInfo();
        const chatDataSnapShot = await get(child(ref(db), `1on1Chats/${chatId}`))

        if (!chatDataSnapShot.exists()) {
            throw new Error('The chat does not exist in the firebase db.')
        }

        return { wasSuccessful: true, data: chatDataSnapShot.val() }
    } catch (error) {
        const errorMsg = `An error has occurred in getting the chat from the database. Error message: ${error}`

        console.error(errorMsg)

        return { wasSuccessful: false, msg: errorMsg }
    }
}

async function getAllUserChats(currentUserId: string): Promise<CRUDResult> {
    try {
        console.log("Getting thet chat id of the following user: ", currentUserId)

        const getChatUserByIdResult = await getChatUserById(currentUserId);

        console.log('getChatUserByidResult: ', getChatUserByIdResult)

        if (!getChatUserByIdResult.wasSuccessful) {
            throw new Error('An error has occurred in getting the chat user from the database.')
        }

        if (!getChatUserByIdResult?.data) {
            throw new Error('The current user does not have chat object in the firebase database.')
        }

        const userChatIdsObj = getChatUserByIdResult.data as UserChatIdsInterface

        if (!userChatIdsObj?.chatIds?.length) {
            console.log('This users is not chatting with anybody.')
            return { wasSuccessful: true, data: [] }
        }

        const currentUserChatsPromises = userChatIdsObj.chatIds.map(chatId => getChatById(chatId))
        let currentUserChats: CRUDResult[] | ChatInterface[] = await Promise.all(currentUserChatsPromises);
        currentUserChats = currentUserChats.filter(chat => chat.wasSuccessful).map(chat => (chat.data as ChatInterface))
        console.log('currentUserChats: ', currentUserChats)
        let chatUserRecipientIds = [
            ...new Set(
                currentUserChats
                    .flatMap(({ userIdA, userIdB }: ChatInterface) => [userIdA, userIdB])
                    .filter(userId => currentUserId !== userId)
            )
        ]

        console.log('The ids of the users that the current user is chatting with: ', chatUserRecipientIds)

        return { wasSuccessful: true, data: chatUserRecipientIds }
    } catch (error) {
        console.error('An error has occurred in getting the chat user from the firebase database.')

        return { wasSuccessful: false }
    }
}

export { getChatById, getChatUserById, getAllUserChats }
