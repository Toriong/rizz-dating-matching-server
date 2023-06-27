
type Sex = 'Female' | 'Male'
interface UserLocation {
    longitude: number,
    latitude: number,
}
interface UserQueryOpts {
    sexAttraction: String,
    userLocation: UserLocation,
    radiusInMilesInt: number,
    desiredAgeRange: [string, string],
    paginationPageNum: number
}


export { UserQueryOpts, UserLocation, Sex }