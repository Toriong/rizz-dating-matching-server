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
// 
const s3 = new aws.S3({
    credentials: {
        secretAccessKey: process.env.AWS_S3_SECRET_KEY,
        accessKeyId: process.env.AWS_S3_ACCESS_KEY
    }
});
const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: 'test-img-1.jpg',
    Expires: 86400000
};
s3.getSignedUrlPromise('getObject', params).then(url => {
    console.log('url: ', url);
}).catch(error => {
    console.error('An error has occurred: ', error);
});
function getMatches() {
    return __awaiter(this, void 0, void 0, function* () {
    });
}
export { getMatches };
