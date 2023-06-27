
type Sex = 'Female' | 'Male'
interface UserLocation {
    longitude: number | string,
    latitude: number | string,
}
interface UserQueryOpts {
    sexAttraction: string,
    userLocation: UserLocation,
    radiusInMilesInt: number | string,
    desiredAgeRange: [string, string],
    paginationPageNum: number | string
}

interface ReqQueryMatchesParams{
    query: UserQueryOpts,
    userId: string
}


export { UserQueryOpts, UserLocation, Sex, ReqQueryMatchesParams }