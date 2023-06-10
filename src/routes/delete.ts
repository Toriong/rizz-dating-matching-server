import { Router } from 'express'

const router = Router()

// delete the rejected user from the database for the following reasons:

// when the user deletes their account, delete all documents that has the id of the user in the field of rejectorUserId

// when the user manually deletes the rejected user from the database

router.route('update-rejected-uesr').delete(async (request, response) => {
    
})