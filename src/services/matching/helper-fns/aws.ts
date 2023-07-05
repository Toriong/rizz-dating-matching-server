import aws from 'aws-sdk'
import dotenv from 'dotenv';

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

async function getMatchPicUrl(pathToImg: string, expiresNum: number = (60_000 * 60)): Promise<MatchPicUrlReturnResult> {
    try {
        dotenv.config();
        const {  AWS_S3_SECRET_KEY, AWS_S3_ACCESS_KEY, AWS_BUCKET_NAME } = process.env;
        const s3 = getS3Instance(AWS_S3_SECRET_KEY as string, AWS_S3_ACCESS_KEY as string);
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

export { getMatchPicUrl }