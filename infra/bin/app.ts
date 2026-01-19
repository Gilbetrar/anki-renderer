#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StaticSiteStack } from '../lib/static-site-stack';

const app = new cdk.App();

new StaticSiteStack(app, 'AnkiRendererDemoStack', {
  env: {
    account: '719390918663',
    region: 'us-east-1', // Required for CloudFront certificates
  },
  domainName: 'anki-renderer.bjblabs.com',
  hostedZoneId: 'Z0806990T0ZB8GBKDCD9',
  hostedZoneName: 'bjblabs.com',
});
