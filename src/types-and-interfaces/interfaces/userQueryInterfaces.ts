
interface UserLocation {
    longitude: number | string,
    latitude: number | string,
}
interface UserQueryOpts {
    sexAttraction: string,
    // first number: latitude, second number: longitude
    userLocation: [number | string, number | string],
    // first number: min distance, second number: max distance
    minAndMaxDistanceArr: [number | string, number | string],
    desiredAgeRange: [string, string],
    skipDocsNum: number | string
    isRadiusSetToAnywhere?: boolean | string
}
interface ReqQueryMatchesParams {
    query: UserQueryOpts,
    userId: string
}

interface QueryValidationInterface {
    correctVal: string | string[],
    isCorrectValType: boolean,
    fieldName: string,
    val: unknown,
    receivedType: string,
    receivedTypeInArr?: string[],
    recievedTypeOfValsInArr?: ({ fieldName: string, receivedType: string } | string)[]
}

export { UserQueryOpts, UserLocation, ReqQueryMatchesParams, QueryValidationInterface }
