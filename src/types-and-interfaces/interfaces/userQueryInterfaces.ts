
interface UserLocation {
    longitude: number | string,
    latitude: number | string,
}
interface UserQueryOpts {
    sexAttraction: string,
    // first number: latitude, second number: longitude
    userLocation: [number | string, number | string],
    // first number: min distance, second number: max distance
    minAndMaxDistanceArr: [number| string, number | string],
    desiredAgeRange: [string, string],
    skipDocsNum: number | string
    isRadiusSetToAnywhere?: boolean
}
interface ReqQueryMatchesParams{
    query: UserQueryOpts,
    userId: string
}

export { UserQueryOpts, UserLocation, ReqQueryMatchesParams }
