# bundler

## Requirements

* AWS CLI already configured with Administrator permission
* [Docker installed](https://www.docker.com/community-edition)
* [Golang](https://golang.org)
* SAM CLI - [Install the SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)

## Setup process

### Installing dependencies & building the target

In this example we use the built-in `sam build` to automatically download all the dependencies and package our build target.
Read more about [SAM Build here](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-build.html)

The `sam build` command is wrapped inside of the `Makefile`. To execute this simply run

```shell
make build
```

### Local development

**Invoking function locally through local API Gateway**

```bash
sam local start-api
```

If the previous command ran successfully you should now be able to hit the following local endpoint to invoke your function `http://localhost:3000/healthz`

## Packaging and deployment

To deploy your application for the first time, run the following in your shell:

```bash
sam deploy --guided
```

The command will package and deploy your application to AWS, with a series of prompts:

* **Stack Name**: The name of the stack to deploy to CloudFormation. This should be unique to your account and region, and a good starting point would be something matching your project name.
* **AWS Region**: The AWS region you want to deploy your app to.
* **Confirm changes before deploy**: If set to yes, any change sets will be shown to you before execution for manual review. If set to no, the AWS SAM CLI will automatically deploy application changes.
* **Allow SAM CLI IAM role creation**: Many AWS SAM templates, including this example, create AWS IAM roles required for the AWS Lambda function(s) included to access AWS services. By default, these are scoped down to minimum required permissions. To deploy an AWS CloudFormation stack which creates or modifies IAM roles, the `CAPABILITY_IAM` value for `capabilities` must be provided. If permission isn't provided through this prompt, to deploy this example you must explicitly pass `--capabilities CAPABILITY_IAM` to the `sam deploy` command.
* **Save arguments to samconfig.toml**: If set to yes, your choices will be saved to a configuration file inside the project, so that in the future you can just re-run `sam deploy` without parameters to deploy changes to your application.

You can find your API Gateway Endpoint URL in the output values displayed after deployment.

### Testing

Unit test is not ready until we find out a way to generate testing payload.

Manually tested though.

## API

### GET /healthz

Test server online status.

- Response 200 (application/json)

    - Attributes (object)

        - `hello` (string, required) - Value must be `bundler`.
        - `bundler_eoa` (string, required) - EOA wallet of current bundler server instance.
        - `chain_id` (string, required) - On which chain this server is working on.
        - `entrypoint_contract_address` (string, required) - Which entrypoint contract this server is connected to.

    - Body

        ```json
        {
            "hello": "bundler",
            "bundler_eoa": "0x441D3F77bA64d427f31d215b504D9fF56301ACF6",
            "chain_id": "80001",
            "entrypoint_contract_address": "0x8A42F70047a99298822dD1dbA34b454fc49913F2"
        }
        ```

### POST /handle

Send user operations to entrypoint contract.

- Request (application/json)

> Refer to main document of this project (WIP) to find out meaning of these params.

    - Attributes (object)

        - `user_operations` (Array[object], required) - UserOperations
            - `sender` (string, required) - Should be wallet address like `0x123456abcdef...`
            - `nonce` (string, required) - Numberish string to represent big number.
            - `init_code` (string, required) - Should be Base64-encoded binary stream.
            - `call_data` (string, required) - Should be Base64-encoded binary stream.
            - `call_gas` (string, required) - Numberish string to represent big number.
            - `verification_gas` (string, required) - Numberish string to represent big number.
            - `pre_verification_gas` (string, required) - Numberish string to represent big number.
            - `max_fee_per_gas` (string, required) - Numberish string to represent big number.
            - `max_priority_fee_per_gas` (string, required) - Numberish string to represent big number.
            - `paymaster` (string, required) - Should be wallet address like `0x123456abcdef...`
            - `paymaster_data` (string, required) - Should be Base64-encoded binary stream.
            - `signature` (string, required) - Should be Base64-encoded binary stream.

- Response 200 (application/json)

    - Attributes (object)

        - `tx_hash` (string, required) - Transaction Hash.
