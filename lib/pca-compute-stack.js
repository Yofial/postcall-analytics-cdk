import {
  Stack,
  Duration,
  aws_lambda as lambda,
  aws_sqs as sqs,
  aws_iam as iam,
  aws_stepfunctions as sfn
} from 'aws-cdk-lib';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// === helper to replace __dirname in ESM ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PcaComputeStack extends Stack {
  constructor(scope, id, { bucket, ...props }) {
    super(scope, id, props);

    // ----- Lambda defaults -----
    const lambdaCfg = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: Duration.minutes(2),
      memorySize: 1024,
      environment: { BUCKET: bucket.bucketName },
      bundling: { minify: true }
    };

    // ----- Lambdas -----
    const prepareFn = new lambda.Function(this, 'PrepareJobFn', {
      ...lambdaCfg,
      handler: 'handler.main',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../lambdas/prepare_job')
      )
    });

    const slimFn = new lambda.Function(this, 'SlimJsonFn', {
      ...lambdaCfg,
      handler: 'handler.main',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../lambdas/slim_json')
      )
    });

    const bedrockWorker = new lambda.Function(this, 'BedrockWorkerFn', {
      ...lambdaCfg,
      handler: 'handler.main',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../lambdas/bedrock_worker')
      ),
      reservedConcurrentExecutions: 8 // <- Bedrock TPS cap
    });

    const collectFn = new lambda.Function(this, 'CollectResultsFn', {
      ...lambdaCfg,
      handler: 'handler.main',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../lambdas/collect_results')
      )
    });

    // S3 permissions
    bucket.grantReadWrite(prepareFn);
    bucket.grantReadWrite(slimFn);
    bucket.grantReadWrite(collectFn);
    bucket.grantPut(bedrockWorker); // write analysis output only

    prepareFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['transcribe:StartTranscriptionJob'],
        resources: ['*']
      })
    );
    bedrockWorker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: ['*']
      })
    );

    // ----- SQS Queues -----
    const invocationQ = new sqs.Queue(this, 'BedrockInvocationQ', {
      fifo: true,
      queueName: `${this.stackName}-bedrock-invocations.fifo`,
      visibilityTimeout: Duration.minutes(5),
      contentBasedDeduplication: true
    });

    const analysisQ = new sqs.Queue(this, 'AnalysisEventsQ', {
      fifo: true,
      queueName: `${this.stackName}-analysis-events.fifo`,
      visibilityTimeout: Duration.minutes(2),
      contentBasedDeduplication: true
    });

    // env for worker
    bedrockWorker.addEnvironment('QUEUE_URL', invocationQ.queueUrl);

    // ----- Step Function -----
    const asl = readFileSync(
      path.join(__dirname, '../stepfn_asl.json'),
      'utf8'
    )
      .replace('${PrepareJobLambdaArn}', prepareFn.functionArn)
      .replace('${SlimJsonLambdaArn}', slimFn.functionArn)
      .replace('${CollectResultsLambdaArn}', collectFn.functionArn)
      .replace('${BedrockInvocationQueue}', invocationQ.queueUrl)
      .replace('${TranscribeOutputBucket}', bucket.bucketName);

    const stateMachine = new sfn.CfnStateMachine(this, 'Workflow', {
      stateMachineName: `${this.stackName}-workflow`,
      roleArn: prepareFn.role.roleArn,
      definitionString: asl,
      stateMachineType: 'STANDARD'
    });

    // Event source mapping
    bedrockWorker.addEventSourceMapping('InvocationMapping', {
      eventSourceArn: invocationQ.queueArn,
      batchSize: 1
    });

    // Expose to other stacks
    this.analysisQueue = analysisQ;
    this.stateMachine = stateMachine;
    this.bedrockWorker = bedrockWorker;
  }
}

