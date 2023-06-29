
interface MessageInterface {
    _id: String,
    msg: String,
    isMatchReq: Boolean,
    timeStampMs: Number,
    senderId: String,
    recipientId: String,
    wasReadByRecipient: Boolean
}

interface ChatInterface {
    userIdA: string,
    userIdB: string,
    messages: MessageInterface[]
}

interface UserChatIdsInterface {
    createdAt: Number,
    chatIds: String[]
}



export { MessageInterface, ChatInterface, UserChatIdsInterface }