import { Router, Request, Response } from 'express'
import { getRejectedUsers } from '../services/rejectedUsersService.js';

const router = Router()


router.route('get-rejected-users').get(async (request: Request, response: Response) => {
    // GOAL: get the rejected users from the database based on the id of the user that will be in the params of the request
    // the rejected users are retrieved from the database 
    // all of the documents are retrieved based on the id of that was sent to the server in the request object, by querying the database
    // access the RejectedUser document
    // the id of the current user is retrieved in the request object 
    // get the id of the current user in the request object
    // the request is sent to the server to get all of the user that were rejected by the current user
    const { userId } = request.query;

    if((typeof userId !== 'string') || !userId){
        return response.status(404).json({ msg: 'The id of the user is either not present in the request object or has an invalid data type.' })
    }

    try {
        const rejectedUsers = await getRejectedUsers(userId)
        
        return response.status(200).json({ msg: 'The rejected users have been successfully retrieved from the database.', rejectedUsers: rejectedUsers })
    } catch (error) {
        const errMsg = `An error has occurred in getting the rejected users from the database. Error message: ${error}`

        return response.status(500).json({ msg: errMsg })
    }
})
