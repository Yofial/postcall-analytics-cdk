import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqs = new SQSClient({});
const OUT_QUEUE_URL = process.env.OUT_QUEUE_URL || '';

export const main = async (event) => {
  const callId = event.prepare.callId;
  const items = event.results; // S3 keys from Map

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: OUT_QUEUE_URL,
      MessageBody: JSON.stringify({ callId, items }),
      MessageGroupId: callId
    })
  );
  return { ok: true };
};

