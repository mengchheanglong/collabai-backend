#!/bin/sh
set -eu
awslocal s3 mb s3://collabai-staging || true
awslocal s3api put-bucket-cors --bucket collabai-staging --cors-configuration file:///etc/localstack/init/ready.d/s3-cors.json
