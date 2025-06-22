// lib/pca-storage-stack.js
import { Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';

/**
 * Storage stack – imports an existing S3 bucket instead of creating a new one.
 *
 * Props:
 *   existingBucketName  (string)  – name of an S3 bucket that already exists
 */
export class PcaStorageStack extends Stack {
  constructor(scope, id, { existingBucketName, ...props }) {
    super(scope, id, props);

    // === Import existing bucket – no new S3 resource is created ===
    this.bucket = Bucket.fromBucketName(
      this,
      'ImportedBucket',
      existingBucketName
    );
  }
}
