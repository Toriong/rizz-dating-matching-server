import { RejectedUser } from '../models/RejectedUser.js';
import { CRUDResult, RejectedUserInterface } from '../types-and-interfaces/interfaces.js';
import { FnReturnsPromiseDocument, ModelType } from '../types-and-interfaces/types.js';




interface CustomModel extends ModelType {
    save: FnReturnsPromiseDocument
}

async function insertRejectedUser(rejectedUserDocument: RejectedUserInterface): Promise<CRUDResult> {
    try {
        const newRejectedUser: CustomModel = new RejectedUser({ ...rejectedUserDocument })
        const rejectedUserSaveResult = await newRejectedUser.save()

        rejectedUserSaveResult.validateSync()

        console.log('A new document was inserted into the db.')

        return { status: 200 }
    } catch (error) {
        const errMsg = `An error has occurred in rejectedUsersService.ts: insertRejectedUser(). Error message: ${error}`

        console.error(errMsg)

        return { status: 500, msg: errMsg }
    }
}

async function deleteRejectedUser(userIds: string[]): Promise<CRUDResult | void> {
    try{
        // GOAL: delete the rejected users from the database by way of their ids
        // the target users or user was deleted from the database by their ids or id
        // using the ids, delete all docuements that contain the ids of the users or user 
        // the conditional is received
        // in the get request, get the conditional of the deletion of the rejected users (rejectedUserId or rejectorUserId)
        // parse the ids  
        // the id of the users or users were recevied from the client
    } catch(error){
        console.error('An error has occurred in deleting the rejected user from the database. Error message: ', error)
    }
}

async function getRejectedUsers(userId: string): Promise<CRUDResult> {
    try {
        const rejectedUsers = await RejectedUser.find({ rejectorUserId: userId })

        return { status: 200, data: rejectedUsers }
    } catch (error) {
        console.error('An error ha occurred in getting  the rejected users from the database. Error message: ', error)
        return { status: 500, msg: 'An error ha occurred in getting  the rejected users from the database. Error message: ' + error }
    }
}


export { insertRejectedUser, getRejectedUsers }