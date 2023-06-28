import { RejectedUser as RejectedUsers } from '../../models/RejectedUser.js';
import { CRUDResult } from '../../types-and-interfaces/interfaces/globalInterfaces.js';
import { RejectedUserInterface } from '../../types-and-interfaces/interfaces/rejectedUserDocsInterfaces.js';
import { FnReturnsPromiseDocument, ModelType } from '../../types-and-interfaces/types.js';

interface NewRejectedUser extends ModelType {
    save: FnReturnsPromiseDocument
}

async function insertRejectedUser(rejectedUserDocument: RejectedUserInterface): Promise<CRUDResult> {
    try {
        const newRejectedUser: NewRejectedUser = new RejectedUsers({ ...rejectedUserDocument })
        const rejectedUserSaveResult = await newRejectedUser.save()

        rejectedUserSaveResult.validateSync()

        console.log('A new document was inserted into the db.')

        return { wasSuccessful: true, status: 200 }
    } catch (error) {
        const errMsg = `An error has occurred in rejectedUsersService.ts: insertRejectedUser(). Error message: ${error}`

        console.error(errMsg)

        return { wasSuccessful: false, status: 500, msg: errMsg }
    }
}

interface QueryVal {
    $in: string[]
}

interface RejectedUsersQuery {
    rejectedUserId?: QueryVal,
    rejectorUserId?: QueryVal
}



async function deleteRejectedUser(queryObj: RejectedUsersQuery): Promise<CRUDResult> {
    try {
        const results = await RejectedUsers.deleteMany(queryObj)

        return { wasSuccessful: true, status: 200, msg: `Number of rejectedUsers documents that were deleted: ${results.deletedCount}` }
    } catch (error) {
        console.error('An error has occurred in deleting the rejected user from the database. Error message: ', error)

        return { wasSuccessful: false, status: 500, msg: "An error has occurred in deleting the rejectedUsers from database." }
    }
}

interface RejectedUsersOrQuery {
    $or: RejectedUsersQuery[]
}

async function getRejectedUsers(queryObj: RejectedUsersQuery | RejectedUsersOrQuery): Promise<CRUDResult> {
    try {
        const rejectedUsers: RejectedUserInterface[] | [] = await RejectedUsers.find(queryObj).lean();

        return { wasSuccessful: true, status: 200, data: rejectedUsers }
    } catch (error) {
        console.error('An error ha occurred in getting  the rejected users from the database. Error message: ', error)
        return { wasSuccessful: false, status: 500, msg: 'An error ha occurred in getting  the rejected users from the database. Error message: ' + error }
    }
}


export { insertRejectedUser, getRejectedUsers, deleteRejectedUser }