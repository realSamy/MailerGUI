import {Queue, Worker, Job} from 'bullmq';
import IORedis from 'ioredis';
import {MessagePreparer} from '~/utils/DataGenerator';
import {MailerConfig, SMTPConfig, Message} from "~/src/types/types";
import {WebSocketLogger} from "~/utils/WebSocketLogger";
import {SMTPTransporterPool} from "~/utils/pools";
import {SendMailOptions} from 'nodemailer';
import {simpleParser} from "mailparser";

const logger = WebSocketLogger.getInstance();

const progressData = {
    progress: 0,
    count: 0
};

export class MailQueue {
    public queue: Queue;
    public worker: Worker;
    private static instance: MailQueue;
    private progressData: { count: number; progress: number };

    private constructor(private config: MailerConfig) {
        const connection = new IORedis({host: 'redis', port: 6379, maxRetriesPerRequest: null, reconnectOnError: () => 2});
        this.queue = new Queue('mailQueue', {connection, defaultJobOptions: {removeOnComplete: true}});
        this.worker = new Worker('mailQueue', processEmail, {connection, concurrency: this.config.workers});
        this.progressData = progressData;
        this.progressData.progress = 1;

        logger.sendLog({type: 'progress', message: this.progressData.progress})

        this.worker.on('completed', async (job) => {
            logger.sendLog({type: 'progress', message: Math.floor(this.progressData.progress / job.data.count * 100)})

            this.progressData.count = job.data.count;
            this.progressData.progress++;
        })

        this.worker.on('failed', (job, error) => {
            console.log('Error: ' + job?.data.receiver, error);
        })

        this.worker.on('paused', () => {
            logger.sendLog({type: 'progress', message: undefined});
        })

        this.worker.on('resumed', () => {
            logger.sendLog({type: 'info', message: 'Worker resumed...'})
            logger.sendLog({type: 'progress', message: this.progressData.progress});
        });

        this.worker.on('closed', () => {
            logger.sendLog({type: 'danger', message: 'Sending Stopped.'})
            logger.sendLog({type: 'progress', message: undefined});
        })

    }

    static async setup(config: MailerConfig) {
        const instance = new this(config);
        instance.progressData.progress = 1;
        this.instance = instance;
        return instance;

    }

    static getInstance(){
        return this.instance;
    }

}

async function processEmail (job: Job<{smtp: SMTPConfig, receiver: string, messages: Message[], config: MailerConfig}>)  {
    const {smtp, receiver, messages, config} = job.data;

    logger.sendLog({type: 'log', message: 'Sending to: ' + receiver});
    const transporterPool = SMTPTransporterPool.getInstance(smtp, config);
    const transporter = await transporterPool.acquire();

    try {
        for (let message of messages) {
            if (message.messageType == 'raw') {
                const parsedMessage = await simpleParser(message.bodyRawContent)
                message = {
                    messageType: 'editor',
                    headers: parsedMessage.headers,
                    attachments: parsedMessage.attachments.map(attachment => ({
                        filename: attachment.filename,
                        filetype: attachment.type,
                        content: attachment.content,
                        size: attachment.size,
                    })),
                    bodyHTMLEditor: parsedMessage.html,
                    subject: message.subject || parsedMessage.subject,
                }
            }

            const preparer = await MessagePreparer.setup(message, smtp, receiver, config)
            const email: SendMailOptions = {
                from: smtp.from,
                to: receiver,
                subject: preparer.subject,
                text: preparer.text,
                html: await preparer.html(),
                attachments: preparer.attachments,
                headers: preparer.headers,
                list: preparer.listHeaders,
            }
            console.log(email)
            await transporter.sendMail(email)
        }
        logger.sendLog({type: 'success', message: `[${progressData.progress || 1} / ${progressData.count || '-'}] ` + 'Sent: ' + receiver});
        console.info([progressData.progress], 'Sent: ' + receiver);
    } catch (e: any) {
        logger.sendLog({type: 'danger', message: 'Error: ' + receiver});
        logger.sendLog({type: 'danger', message: e.message});

        console.error('Error: ' + receiver)
        console.error(e)
    } finally {
        await transporterPool.release(transporter);
    }
}
