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
dotenv.config();
function getS3Instance() {
    return new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });
}
function getMatchPicUrl(pathToImg, expiresNum) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const s3 = getS3Instance();
            const params = {
                Bucket: process.env.AWS_BUCKET_NAME,
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
export { getMatchPicUrl };
