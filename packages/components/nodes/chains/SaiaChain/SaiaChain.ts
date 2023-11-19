import { ICommonObject, INode, INodeData, INodeOptionsValue, INodeParams } from '../../../src/Interface'
import { ConversationChain } from 'langchain/chains'
import { fetchAssistants, getBaseClasses } from '../../../src/utils'
import { ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from 'langchain/prompts'
import { BufferMemory } from 'langchain/memory'
import { flatten } from 'lodash'
import { Document } from 'langchain/document'
import { ChatOpenAI, OpenAIChatInput } from 'langchain/chat_models/openai'

let systemMessage = `The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.`

class SaiaChain_Chains implements INode {
    label: string
    name: string
    version: number
    type: string
    icon: string
    category: string
    baseClasses: string[]
    description: string
    inputs: INodeParams[]
    prompt: string

    constructor() {
        this.label = 'Saia Chain'
        this.name = 'saiaChain'
        this.version = 1.0
        this.type = 'ConversationChain'
        this.icon = 'saia.svg'
        this.category = 'Chains'
        this.description = 'Chat models specific conversational chain with memory'
        this.baseClasses = [this.type, ...getBaseClasses(ConversationChain)]
        this.inputs = [
            {
                label: 'Assistant',
                name: 'assistant',
                type: 'asyncOptions',
                loadMethod: 'loadAssistants'
            },
            {
                label: 'Memory',
                name: 'memory',
                type: 'BaseMemory'
            },
            {
                label: 'Document',
                name: 'document',
                type: 'Document',
                description:
                    'Include whole document into the context window, if you get maximum context length error, please use model with higher context window like Claude 100k, or gpt4 32k',
                optional: true,
                list: true
            },
            {
                label: 'System Message',
                name: 'systemMessagePrompt',
                type: 'string',
                rows: 4,
                additionalParams: true,
                optional: true,
                placeholder: 'You are a helpful assistant that write codes'
            }
        ]
    }

    //@ts-ignore
    loadMethods = {
        async loadAssistants(node: INodeData, _options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []
            try {
                const assistants: { assistants: any[] } = await fetchAssistants()
                console.log(assistants)
                // traverse assistants and push in returnData
                for (const assistant of assistants.assistants) {
                    const data = {
                        label: assistant.assistantName,
                        name: assistant.assistantName,
                        description: assistant.assistantDescription
                    } as INodeOptionsValue
                    returnData.push(data)
                }
            } catch {
                const data = {
                    label: 'ContractComparer',
                    name: 'ContractComparer',
                    description: 'Compare two contracts'
                } as INodeOptionsValue
                returnData.push(data)
            }

            return returnData
        }
    }

    async init(nodeData: INodeData): Promise<any> {
        const openAIApiKey = process.env.SAIA_API_KEY
        const objChat: Partial<OpenAIChatInput> & { openAIApiKey?: string } = {
            temperature: 0.5,
            modelName: 'gpt-3.5-turbo-16k',
            openAIApiKey,
            streaming: true
        }
        const uri = process.env.SAIA_PROXY_URI || 'https://api.qa.saia.ai/proxy/openai/v1'
        const model = new ChatOpenAI(objChat, {
            basePath: uri
        })
        const memory = nodeData.inputs?.memory as BufferMemory
        const prompt = nodeData.inputs?.systemMessagePrompt as string

        const obj: any = {
            llm: model,
            memory,
            verbose: process.env.DEBUG === 'true' ? true : false
        }

        const chatPrompt = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(prompt ? `${prompt}\n${systemMessage}` : systemMessage),
            new MessagesPlaceholder(memory.memoryKey ?? 'chat_history'),
            HumanMessagePromptTemplate.fromTemplate('{input}')
        ])
        obj.prompt = chatPrompt
        this.prompt = JSON.stringify(chatPrompt)

        const chain = new ConversationChain(obj)
        return chain
    }

    async run(nodeData: INodeData, input: string, options: ICommonObject): Promise<string> {
        const docs = nodeData.inputs?.document as Document[]

        const flattenDocs = docs && docs.length ? flatten(docs) : []
        const finalDocs = []
        for (let i = 0; i < flattenDocs.length; i += 1) {
            if (flattenDocs[i] && flattenDocs[i].pageContent) {
                finalDocs.push(new Document(flattenDocs[i]))
            }
        }
        const variables = []
        //travers the docs and add to variables with name document1, document2, document3, etc
        for (let i = 0; i < finalDocs.length; i += 1) {
            const key = `document${i + 1}`
            let value = finalDocs[i].pageContent
            const replaceChar: string[] = ['{', '}']
            for (const char of replaceChar) value = value.replaceAll(char, '')
            const variable = { key, value }
            variables.push(variable)
        }

        const assistant = nodeData.inputs?.assistant as string
        let request: any = {
            headers: {
                'Content-Type': 'application/json',
                Authorization: process.env.SAIA_API_KEY
            },
            method: 'POST',
            body: JSON.stringify({
                assistant: assistant,
                messages: [
                    {
                        role: 'user',
                        content: input
                    }
                ],
                variables: variables,
                revision: 0
            })
        }

        try {
            const answerRes = await fetch(`${process.env.SAIA_API_ASSISTANT}/assistant/chat`, request)
            if (answerRes.status != 200) {
                console.log(answerRes)
            }
            const answerData = await answerRes.json()

            if (answerData.success == true) {
                const answer = answerData['text']
                return answer
            } else {
                console.log(answerData)
                return answerData.error.message
            }
        } catch (error) {
            console.error(error)
        }
        return ''
    }
}

module.exports = { nodeClass: SaiaChain_Chains }
