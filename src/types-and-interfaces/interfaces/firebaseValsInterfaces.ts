
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
    userAId: String,
    userBId: String,
    messages: MessageInterface[]
}

interface UserChatIdsInterface {
    createdAt: Number,
    chatIds: String[]
}

export { MessageInterface, ChatInterface, UserChatIdsInterface }