import { User, PaginatedModel } from "../../models/User.js"
import { UserLocation } from "../../types-and-interfaces/interfaces.js"

async function getMatches(currentUserLocation: UserLocation) {
    // GOAL #1: perform pagination of the users collection based on the following criteria:
    // the location of the user (location.longitude, location.latitude)
    // the age of the user (birthDate)
    // the sex of the user
    // get only the highest rated users (user.ratingNum)

    const paginationOptions = {

    }
    
    // const potentialMatches = (User as PaginatedModel).paginate()

    // GOAL #2: check if the result users have been either:
    // rejected by the current user (the user on the client side)
    // or has rejected the current user  

    // GOAL #3: Send the users to the client. 
}

export { getMatches }