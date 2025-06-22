import { SQSClient, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { SFNClient, SendTaskSuccessCommand, SendTaskFailureCommand } from '@aws-sdk/client-step-functions';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const sqs = new SQSClient({});
const br = new BedrockRuntimeClient({});
const sfn = new SFNClient({});
const s3 = new S3Client({});

export const main = async (event) => {
  const rec = event.Records[0];
  const body = JSON.parse(rec.body);
  const { taskToken, promptId, callId } = body;

  try {
    // ==== build prompt (simple) ====
    const prompt = `### PROMPT ${promptId}\nCall ID: ${callId}\n<transcript goes here>`;
    const resp = await br.send(
      new InvokeModelCommand({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({ prompt, max_tokens_to_sample: 1024 })
      })
    );

    const outputKey = `analysis/${promptId}/${callId}.json`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.BUCKET,
        Key: outputKey,
        Body: resp.body
      })
    );

    await sfn.send(
      new SendTaskSuccessCommand({
        taskToken,
        output: JSON.stringify({ s3Key: outputKey })
      })
    );
    await deleteMsg(rec);
  } catch (err) {
    console.error(err);
    await sfn.send(
      new SendTaskFailureCommand({
        taskToken,
        error: err.name || 'BedrockError',
        cause: err.message
      })
    );
  }
};

const deleteMsg = (rec) =>
  sqs.send(
    new DeleteMessageCommand({
      QueueUrl: process.env.QUEUE_URL,
      ReceiptHandle: rec.receiptHandle
    })
  );

