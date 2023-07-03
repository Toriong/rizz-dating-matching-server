import Prompts from "../../models/Prompt.js"
import { CRUDResult } from "../../types-and-interfaces/interfaces/globalInterfaces.js"

async function getPromptByUserId(userId: string): Promise<CRUDResult> {
    try {
        const prompt = await Prompts.findOne({ userId: userId }).lean()

        return { wasSuccessful: true, data: prompt }
    } catch (error) {
        console.error('An error has occurred in getting the prompt of the target user. Error: ', error)

        return { wasSuccessful: false, msg: 'An error has occurred in getting the prompt of the target user.' }
    }
}

// create a function that will get the user's prompts from the database based on an array of userIds
async function getPrompstByUserIds(userIds: string[]): Promise<CRUDResult> {
    try {
        const prompts = await Prompts.find({ userId: { $in: userIds } }).lean()

        return { wasSuccessful: true, data: prompts }
    } catch (error) {
        console.error('An error has occurred in getting the prompts of the target users. Error: ', error)

        return { wasSuccessful: false, msg: 'An error has occurred in getting the prompts of the target users.' }
    }
}


export { getPromptByUserId, getPrompstByUserIds }