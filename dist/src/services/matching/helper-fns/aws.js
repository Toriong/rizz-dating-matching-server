var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import aws from 'aws-sdk';
import dotenv from 'dotenv';
function getS3Instance(accessKeyId, secretAccessKey) {
    return new aws.S3({
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
    });
}
function getDoesImgAwsObjExist(pathToImg) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            dotenv.config();
            const { AWS_S3_SECRET_KEY, AWS_S3_ACCESS_KEY, AWS_BUCKET_NAME } = process.env;
            const s3 = getS3Instance(AWS_S3_ACCESS_KEY, AWS_S3_SECRET_KEY);
            yield s3.headObject({ Bucket: AWS_BUCKET_NAME, Key: pathToImg }).promise();
            return true;
        }
        catch (error) {
            console.error(`'${pathToImg}' does not exist. Error message: `, error);
            return false;
        }
    });
}
function getMatchPicUrl(pathToImg, expiresNum = (60000 * 60)) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            dotenv.config();
            const { AWS_S3_SECRET_KEY, AWS_S3_ACCESS_KEY, AWS_BUCKET_NAME } = process.env;
            const s3 = getS3Instance(AWS_S3_ACCESS_KEY, AWS_S3_SECRET_KEY);
            const params = {
                Bucket: AWS_BUCKET_NAME,
                Key: pathToImg,
                Expires: expiresNum
            };
            const url = yield s3.getSignedUrlPromise('getObject', params);
            return { wasSuccessful: true, matchPicUrl: url };
        }
        catch (error) {
            console.error('An error has occurred: ', error);
            return { wasSuccessful: false };
        }
    });
}
export { getMatchPicUrl, getDoesImgAwsObjExist };
