#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PcaStorageStack } from '../lib/pca-storage-stack.js';
import { PcaComputeStack } from '../lib/pca-compute-stack.js';
import { PcaMonitoringStack } from '../lib/pca-monitoring-stack.js';

const app = new cdk.App();
const PROJECT = 'postcall-analytics';

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION
};

const bucketName =
  app.node.tryGetContext('existingBucket') || 'my-existing-bucket';

const storage = new PcaStorageStack(app, `${PROJECT}-storage`, {
  env,
  existingBucketName: bucketName
});

const compute = new PcaComputeStack(app, `${PROJECT}-compute`, {
  env,
  bucket: storage.bucket
});

new PcaMonitoringStack(app, `${PROJECT}-monitoring`, {
  env,
  queue: compute.analysisQueue,
  stateMachine: compute.stateMachine,
  workerFn: compute.bedrockWorker
});

cdk.Tags.of(app).add('Project', PROJECT);
cdk.Tags.of(app).add('Env', app.node.tryGetContext('env') || 'dev');

app.synth();

