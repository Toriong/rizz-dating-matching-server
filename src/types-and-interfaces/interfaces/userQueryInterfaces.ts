
type Sex = 'Female' | 'Male'
interface UserLocation {
    longitude: number,
    latitude: number,
}
interface UserQueryOpts {
    desiredSex: Sex,
    userLocation: UserLocation,
    radiusInMilesInt: number,
    desiredAgeRange: [Date, Date],
    paginationPageNum: number
}


export { UserQueryOpts, UserLocation, Sex }