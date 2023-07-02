
type Sex = 'Female' | 'Male'
interface UserLocation {
    longitude: number | string,
    latitude: number | string,
}
interface UserQueryOpts {
    sexAttraction: string,
    userLocation: UserLocation,
    radiusInMilesInt: string | number,
    desiredAgeRange: [string, string],
    skipDocsNum: number | string
}
interface ReqQueryMatchesParams{
    query: UserQueryOpts,
    userId: string
}

export { UserQueryOpts, UserLocation, Sex, ReqQueryMatchesParams }
