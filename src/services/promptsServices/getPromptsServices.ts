import Prompts from "../../models/Prompt.js"
import { UserBaseModelSchema, UserNames } from "../../models/User.js"
import { CRUDResult } from "../../types-and-interfaces/interfaces/globalInterfaces.js"
import { PromptInterface, PromptModelInterface } from "../../types-and-interfaces/interfaces/promptsInterfaces.js"

async function getPromptByUserId(userId: string): Promise<CRUDResult> {
    try {
        const promptDoc: PromptModelInterface | null = await Prompts.findOne({ userId: userId }).lean()

        if(!promptDoc){
            throw new Error('Prompt doc not found.')
        }

        return { wasSuccessful: true, data: promptDoc.prompts }
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

type TUser = Pick<UserBaseModelSchema, "_id" | "ratingNum" | "pics">;
type LocationErrorMsgStr = "Can't get user's location." | "Unable to get user's location."
interface IUserMatch extends TUser {
    prompts?: PromptInterface[]
    locationStr?: string
    matchingPicUrl?: string
    name?: UserNames
    locationErrorMsg?: LocationErrorMsgStr,
    firstName?: string,
    // the first value is the latitude, the second is the longitude
    userLocationArr?: [number, number],
}

async function getMatchesWithPrompts(users: IUserMatch[]): Promise<CRUDResult> {
    try {
        const userIds = users.map(({ _id }) => _id)
        const getPromptsByUserIdsResult = await getPrompstByUserIds(userIds)
        const usersWithPrompts: IUserMatch[] = users.map(user => {
            const { name, _id } = user;
            const findPromptResultObj = (getPromptsByUserIdsResult.data as PromptModelInterface[]).find(({ userId }) => userId === _id)
            const _user: IUserMatch = { ...user, firstName: (name as UserNames)?.first, prompts: findPromptResultObj?.prompts }

            delete _user.name;

            return _user;
        })

        return { wasSuccessful: true, data: usersWithPrompts }
    } catch (error) {

        return { wasSuccessful: false, msg: 'An error has occurred in getting the prompts of the target users.' }
    }
}

// create a function that will filter out users that don't have prompts in the database
// users are filter out of the given array since they don't have prompts in the database
// else, filter out the users that don't have prompts in the database
// if a prompt doc was received, then filter in the user
// for each user, using their id, get their prompt from the database 
// an array is attained with users, each user has the userBaseSchemaModal as their interface 
async function filterInUsersWithPrompts(users: UserBaseModelSchema[]): Promise<UserBaseModelSchema[] | []> {
    let usersWithPrompts = []

    console.log("getting prompts for users...")
    
    for (let numIteration = 0; numIteration < users.length; numIteration++) {
        const user = users[numIteration]
        const userPromptsResult = await getPromptByUserId(user._id)

        console.log((userPromptsResult.data as PromptModelInterface[])?.length)

        if (userPromptsResult.wasSuccessful && (userPromptsResult.data as PromptModelInterface[])?.length) {
            console.log("User has prompts, will push into the userWithPrompts array.")
            usersWithPrompts.push(user)
        }
    }

    console.log("usersWithPrompts.length: ", usersWithPrompts.length)

    return usersWithPrompts;
}

export { getPromptByUserId, getPrompstByUserIds, filterInUsersWithPrompts, getMatchesWithPrompts }