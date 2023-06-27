import getFirebaseInfo from "./helper-fns/connectToFirebase.js";
import { CRUDResult } from "../../types-and-interfaces/interfaces/globalInterfaces.js";



async function getChatUserById(userId: string): Promise<CRUDResult> {
    try {
        const { db, child, get, ref } = getFirebaseInfo();
        const chatUserDataSnapShot = await get(child(ref(db), `userChatIds/${userId}`))

        if (!chatUserDataSnapShot.exists()) {
            throw new Error('The chat user does not exist in the firebase db.')
        }

        return { wasSuccessful: true, data: chatUserDataSnapShot.val() }
    } catch (error) {
        console.error(`An error has occurred in getting the chat user from the database, id of user: ${userId}. Error message: `, error)

        return { wasSuccessful: false }
    }
}

// GOAL: get the chat from the firebase db
// the chat is received
// query the db in the followign format: `1on1Chats/${chatId}`
// the id of the chat is passed in as an argument for getChatUser

async function getChatById(chatId: string): Promise<CRUDResult> {
    try {
        const { db, child, get, ref } = getFirebaseInfo();
        const chatDataSnapShot = await get(child(ref(db), `1on1Chats/${chatId}`))

        if(!chatDataSnapShot.exists()){
            throw new Error('The chat does not exist in the firebase db.')
        }

        return { wasSuccessful: true, data: chatDataSnapShot.val() }
    } catch (error) {
        const errorMsg = `An error has occurred in getting the chat from the database. Error message: ${error}`

        return { wasSuccessful: false, msg: errorMsg }
    }
}