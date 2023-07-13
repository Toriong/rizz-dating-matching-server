
interface UserLocation {
    longitude: number | string,
    latitude: number | string,
}
interface UserQueryOpts {
    sexAttraction: string,
    userLocation: [number, number],
    minAndMaxDistanceArr: [number, number],
    desiredAgeRange: [string, string],
    skipDocsNum: number | string
    isRadiusSetToAnywhere?: boolean
}
interface ReqQueryMatchesParams{
    query: UserQueryOpts,
    userId: string
}

export { UserQueryOpts, UserLocation, ReqQueryMatchesParams }
