const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const client = new SecretsManagerClient({ region: 'us-east-1' });

exports.getSecretValue = async secretName => {
   const data = await client.send(new GetSecretValueCommand(({ SecretId: secretName })))
        // Decrypts secret using the associated KMS CMK.
        // Depending on whether the secret is a string or binary, one of these fields will be populated.
        if ('SecretString' in data) {
          return JSON.parse(data.SecretString)
        } else {
          const buff = new Buffer(data.SecretBinary, 'base64')
          return JSON.parse(buff.toString('ascii'))
        }
      }
