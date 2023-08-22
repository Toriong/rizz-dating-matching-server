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
            // console.error(`'${pathToImg}' does not exist. Error message: `, error)
            return false;
        }
    });
}
function filterInUsersWithValidMatchingPicUrl(users) {
    return __awaiter(this, void 0, void 0, function* () {
        let usersWithMatchingPicUrls = [];
        for (let numIteration = 0; numIteration < users.length; numIteration++) {
            const user = users[numIteration];
            const matchingPicObj = user.pics.find(({ isMatching }) => isMatching);
            const doesImgAwsObjExist = ((matchingPicObj === null || matchingPicObj === void 0 ? void 0 : matchingPicObj.isMatching) && (matchingPicObj === null || matchingPicObj === void 0 ? void 0 : matchingPicObj.picFileNameOnAws)) ? yield getDoesImgAwsObjExist(matchingPicObj.picFileNameOnAws) : false;
            if (doesImgAwsObjExist && (matchingPicObj === null || matchingPicObj === void 0 ? void 0 : matchingPicObj.picFileNameOnAws)) {
                usersWithMatchingPicUrls.push(user);
            }
        }
        return usersWithMatchingPicUrls;
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
            const url = s3.getSignedUrl('getObject', params);
            console.log('The URL is: ', url);
            return { wasSuccessful: true, matchPicUrl: url };
        }
        catch (error) {
            console.error('An error has occurred: ', error);
            return { wasSuccessful: false };
        }
    });
}
function getMatchingPicUrlForUsers(users) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let matches = [];
            for (let numIteration = 0; numIteration < users.length; numIteration++) {
                const user = users[numIteration];
                const mathcingPicObj = user.pics.find(({ isMatching }) => isMatching);
                if (mathcingPicObj === null || mathcingPicObj === void 0 ? void 0 : mathcingPicObj.isMatching) {
                    const { wasSuccessful, matchPicUrl } = yield getMatchPicUrl(mathcingPicObj.picFileNameOnAws);
                    if (wasSuccessful) {
                        const match = Object.assign(Object.assign({}, user), { matchingPicUrl: matchPicUrl });
                        matches.push(match);
                    }
                }
            }
            return { wasSuccessful: true, data: matches };
        }
        catch (error) {
            console.error('An error has occurred in getting match pic url for users: ', error === null || error === void 0 ? void 0 : error.message);
            return { wasSuccessful: false, msg: `An error has occurred in getting match pic url for users: ${error.message}` };
        }
    });
}
export { getMatchPicUrl, getDoesImgAwsObjExist, filterInUsersWithValidMatchingPicUrl, getMatchingPicUrlForUsers };
