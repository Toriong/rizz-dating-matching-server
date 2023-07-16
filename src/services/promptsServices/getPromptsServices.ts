import Prompts from "../../models/Prompt.js"
import { UserBaseModelSchema } from "../../models/User.js"
import { CRUDResult } from "../../types-and-interfaces/interfaces/globalInterfaces.js"
import { PromptInterface } from "../../types-and-interfaces/interfaces/promptsInterfaces.js"

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

// create a function that will filter out users that don't have prompts in the database
// users are filter out of the given array since they don't have prompts in the database
// else, filter out the users that don't have prompts in the database
// if a prompt doc was received, then filter in the user
// for each user, using their id, get their prompt from the database 
// an array is attained with users, each user has the userBaseSchemaModal as their interface 
async function filterInUsersWithPrompts(users: UserBaseModelSchema[]): Promise<UserBaseModelSchema[] | []>{
    let usersWithPrompts = []

    for(let numIteration = 0; numIteration < users.length; numIteration++){
        const user = users[numIteration]
        const userPromptsResult = await getPromptByUserId(user._id)

        if(userPromptsResult.wasSuccessful && (userPromptsResult.data as PromptInterface[])?.length){
            usersWithPrompts.push(user)
        }
    }

    return usersWithPrompts;
}


export { getPromptByUserId, getPrompstByUserIds, filterInUsersWithPrompts }