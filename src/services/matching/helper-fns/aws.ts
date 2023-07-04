import aws from 'aws-sdk'
import dotenv from 'dotenv';

function getS3Instance() {
    return new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    })
}

interface MatchPicUrlReturnResult {
    matchPicUrl?: string,
    wasSuccessful: boolean
}

async function getMatchPicUrl(pathToImg: string, expiresNum: number = (60_000 * 60)): Promise<MatchPicUrlReturnResult> {
    try {
        dotenv.config();
        const s3 = getS3Instance();
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
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