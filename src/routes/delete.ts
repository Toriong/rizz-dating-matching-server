import { Router } from 'express'
import GLOBAL_VALS from '../globalVals.js';

const router = Router()

// delete the rejected user from the database for the following reasons:

// when the user deletes their account, delete all documents that has the id of the user in the field of rejectorUserId

// when the user manually deletes the rejected user from the database

router.delete(`/${GLOBAL_VALS.rootApiPath}/delete`,async (request, response) => {
    // delete the rejected users from the databae by the id of the users
    
})

export default router;