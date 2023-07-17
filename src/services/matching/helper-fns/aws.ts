import aws from 'aws-sdk'
import dotenv from 'dotenv';
import { Picture, UserBaseModelSchema } from '../../../models/User.js';
import { IUserMatch } from '../../../types-and-interfaces/interfaces/matchesQueryInterfaces.js';

function getS3Instance(accessKeyId: string, secretAccessKey: string) {
    return new aws.S3({
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
    })
}

interface MatchPicUrlReturnResult {
    matchPicUrl?: string,
    wasSuccessful: boolean
}

async function getDoesImgAwsObjExist(pathToImg: string): Promise<boolean> {
    try {
        dotenv.config();

        const { AWS_S3_SECRET_KEY, AWS_S3_ACCESS_KEY, AWS_BUCKET_NAME } = process.env;
        const s3 = getS3Instance(AWS_S3_ACCESS_KEY as string, AWS_S3_SECRET_KEY as string);
        console.log("pathToImg: ", pathToImg)
        await s3.headObject({ Bucket: AWS_BUCKET_NAME as string, Key: pathToImg }).promise();

        return true;
    } catch (error) {
        console.error(`'${pathToImg}' does not exist. Error message: `, error)

        return false;
    }
}

async function filterInUsersWithValidMatchingPicUrl(users: UserBaseModelSchema[]): Promise<UserBaseModelSchema[] | []> {
    let usersWithMatchingPicUrls: UserBaseModelSchema[] = [];

    for (let numIteration = 0; numIteration < users.length; numIteration++) {
        const user = users[numIteration];
        const matchingPicObj = user.pics.find(({ isMatching }) => isMatching)
        console.log("matchingPicObj.picFileNameOnAws: ", matchingPicObj?.picFileNameOnAws)
        const doesImgAwsObjExist = (matchingPicObj?.isMatching && matchingPicObj?.picFileNameOnAws) ? await getDoesImgAwsObjExist(matchingPicObj.picFileNameOnAws) : false;
        console.log("doesImgAwsObjExist: ", doesImgAwsObjExist)

        if (doesImgAwsObjExist && matchingPicObj?.picFileNameOnAws) {
            console.log('image exist, image file name: ', matchingPicObj.picFileNameOnAws);
            usersWithMatchingPicUrls.push(user)
        }
    }

    return usersWithMatchingPicUrls;
}

async function getMatchPicUrl(pathToImg: string, expiresNum: number = (60_000 * 60)): Promise<MatchPicUrlReturnResult> {
    try {
        dotenv.config();

        const { AWS_S3_SECRET_KEY, AWS_S3_ACCESS_KEY, AWS_BUCKET_NAME } = process.env;
        const s3 = getS3Instance(AWS_S3_ACCESS_KEY as string, AWS_S3_SECRET_KEY as string);
        const params = {
            Bucket: AWS_BUCKET_NAME as string,
            Key: pathToImg,
            Expires: expiresNum
        }
        const url = await s3.getSignedUrlPromise('getObject', params);

        return { wasSuccessful: true, matchPicUrl: url }
    } catch (error) {
        console.error('An error has occurred: ', error)

        return { wasSuccessful: false }
    }
}

type TMatchingPicUser = Pick<UserBaseModelSchema, 'pics'>;
interface IMatchingPicUser extends TMatchingPicUser, IUserMatch {}

async function getMatchingPicUrlForUsers(users: IMatchingPicUser[]) {
    try {
        let matches = [];

        for (let numIteration = 0; numIteration < users.length; numIteration++) {
            const user = users[numIteration];
            const mathcingPicObj = user.pics.find(({ isMatching }) => isMatching)

            if (mathcingPicObj?.isMatching) {
                const { wasSuccessful, matchPicUrl } = await getMatchPicUrl(mathcingPicObj.picFileNameOnAws);

                if (wasSuccessful) {
                    matches.push({ ...user, matchingPicUrl: matchPicUrl })
                }
            }
        }

        return { wasSuccessful: true, data: matches }
    } catch (error: any) {
        console.error('An error has occurred in getting match pic url for users: ', error?.message)

        return { wasSuccessful: false, msg: `An error has occurred in getting match pic url for users: ${error.message}` }
    }
}

export { getMatchPicUrl, getDoesImgAwsObjExist, filterInUsersWithValidMatchingPicUrl, getMatchingPicUrlForUsers, IMatchingPicUser }
