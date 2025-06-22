import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { normalizeText, maskPanAndCvv } from './sanitize.js';

const s3 = new S3Client({});

export const main = async (event) => {
  const bucket = process.env.BUCKET;
  const key = `transcribe-output/${event.prepare.callId}.json`;

  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const fullText = await streamToStr(obj.Body);
  const json = JSON.parse(fullText);

  // Clean every transcript string
  json.results.transcripts.forEach((tr) => {
    tr.transcript = maskPanAndCvv(normalizeText(tr.transcript));
  });

  // save slim
  const slimKey = key.replace('transcribe-output', 'transcripts-slim');
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: slimKey,
      Body: JSON.stringify(json)
    })
  );

  return {
    callId: event.prepare.callId,
    promptList: ['summary-v1', 'compliance-v1']
  };
};

const streamToStr = (stream) =>
  new Promise((res, rej) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.once('error', rej);
    stream.once('end', () => res(Buffer.concat(chunks).toString('utf8')));
  });

