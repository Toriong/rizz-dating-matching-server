import { RejectedUser } from '../models/RejectedUser.js';
import { CRUDResult, RejectedUserInterface } from '../types-and-interfaces/interfaces.js';
import { FnReturnsPromiseDocument, ModelType } from '../types-and-interfaces/types.js';

// GOAL: create a route that will take route the user to this function in order to insert the rejected user into the database
 


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

async function deleteRejectedUser(rejectedUserDocument: RejectedUserInterface): Promise<CRUDResult | void>  {
}

export { insertRejectedUser }