import { Router } from "express";
import { RejectedUserInterface } from "../types-and-interfaces/interfaces.js";
import { insertRejectedUser } from "../services/rejectedUsersService.js";

const router = Router();
// create a route that will handle the request from the client that will inert all of the users
// into the database 


// this server will handle the following logic:
// insert the rejected users into the database
// update the document of the rejected user by permanently blocking the rejected. this will prevent the rejected user from 
// showing up on the feed of the rejected user 
// delete the rejected users from the database if the user wants to delete them 
// delete all documents of the rejector when the rejector wants to their account




router.route('/insert-rejected-user')
    .post(async (request, response) => {
        const { rejectedUserId, rejectorUserId, reason } = request.body

        if (!rejectedUserId || !rejectorUserId) {
            return response.status(404).json({ devMsg: "The ids of the rejector and the rejected must be provided.", clientMsg: "Something went wrong. We've tracked the user whom you rejected. Please try again. If the error persist, please reset the app. You can find the users that were failed to be rejected in your messages tab." })
        }

        const rejectedUser: RejectedUserInterface = { rejectedUserId: rejectedUserId, rejectorUserId: rejectorUserId, reason: reason || null }

        try {
            const insertionPromiseResult = await insertRejectedUser(rejectedUser)
            const { status, msg } = insertionPromiseResult;

            if ((status === 500) && (typeof msg === 'string')) {
                return response.status(status).json({ devMsg: msg, clientMsg: "Something went wrong. We've tracked the user whom you rejected. Please try again. If the error persist, please reset the app. You can find the users that were failed to be rejected in your messages tab." })
            }

            return response.status(200).json({ devMsg: "The rejected user has been successfully inserted into the database." })
        } catch (error) {
            console.error('An error has occurred in inserting the rejected user into the database: ', error)

            return response.status(500).json({ devMsg: `Failed to insert the rejected user into the db. Error message ${error}.` })
        }
        // GOAL 1: the request has valid body, pass the body to the insertRejectedUser function

        // GOAL 2: validate the request body, check if it has the required properties:
        // id of the rejector is present
        // id of the rejected is present 
        // reason for rejecting is present


        // the validation passes, the rejected user is passed as an argument for the insertRejectedUser function
        // the object of the rejected user is created 
        // the request's body is attained, check if id of the rejector and rejected are present. Both of them are required   

    })
