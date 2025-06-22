const { Stack } = require('aws-cdk-lib');
const s3 = require('aws-cdk-lib/aws-s3');

class PcaStorageStack extends Stack {
  constructor(scope, id, { existingBucketName, ...props }) {
    super(scope, id, props);

    // Import instead of create
    this.bucket = s3.Bucket.fromBucketName(
      this,
      'ImportedBucket',
      existingBucketName
    );
  }
}

module.exports = { PcaStorageStack };

