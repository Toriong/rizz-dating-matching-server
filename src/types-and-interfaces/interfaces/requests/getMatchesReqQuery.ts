import { UserQueryOpts } from "../userQueryInterfaces.js"

interface RequestQuery extends Omit<UserQueryOpts, 'userLocation' | 'radiusInMilesInt' | 'skipDocsNum'> {
    userLocation: { latitude: string, longitude: string }
    radiusInMilesInt: string
    skipDocsNum: string,
    numOfMatchesToReceiveForClient: number | string
}

export { RequestQuery }