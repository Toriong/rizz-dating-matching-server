import { Router, Request, Response } from 'express'
import { getRejectedUsers } from '../services/rejectedUsersService.js';

const router = Router()


router.route('get-rejected-users').get(async (request: Request, response: Response) => {
    
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

export default router;
