import {
  Stack,
  Duration,
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as actions,
  aws_sns as sns,
  aws_sns_subscriptions as subs
} from 'aws-cdk-lib';

export class PcaMonitoringStack extends Stack {
  constructor(scope, id, { queue, workerFn, ...props }) {
    super(scope, id, props);

    // === SNS topic & email subscription ===
    const topic = new sns.Topic(this, 'AlarmTopic');
    topic.addSubscription(
      new subs.EmailSubscription('alerts@example.com') // TODO: change
    );

    // Queue depth alarm
    new cw.Alarm(this, 'QueueDepth', {
      metric: queue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5)
      }),
      threshold: 5000,
      evaluationPeriods: 1,
      alarmDescription: 'SQS depth high'
    }).addAlarmAction(new actions.SnsAction(topic));

    // Worker throttles alarm
    new cw.Alarm(this, 'WorkerThrottles', {
      metric: workerFn.metricThrottles(),
      threshold: 1,
      evaluationPeriods: 1
    }).addAlarmAction(new actions.SnsAction(topic));
  }
}

