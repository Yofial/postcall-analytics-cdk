exports.main = async (event) => {
  /* event = S3:ObjectCreated => EventBridge format */
  const rec = event.detail?.object || {};
  const key = rec.key || 'demo.wav';
  const callId = key.split('/').pop().replace('.wav', '');

  return {
    jobName: `pca-${callId}-${Date.now()}`,
    mediaUri: `s3://${process.env.BUCKET}/${key}`,
    callId
  };
};

