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

        return { status: 200 }
    } catch (error) {
        const errMsg = `An error has occurred in rejectedUsersService.ts: insertRejectedUser(). Error message: ${error}`

        console.error(errMsg)

        return { status: 500, msg: errMsg }
    }
}

async function deleteRejectedUser(rejectedUserDocument: RejectedUserInterface): Promise<CRUDResult | void> {

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