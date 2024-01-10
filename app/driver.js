const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  ListUsersCommand, AdminSetUserPasswordCommand, AdminUpdateUserAttributesCommand
} = require('@aws-sdk/client-cognito-identity-provider')
const client = new CognitoIdentityProviderClient({ region: 'us-east-1' })
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb')
const dynamo = new DynamoDBClient({ region: 'us-east-1' })
const { marshall } = require('@aws-sdk/util-dynamodb')
const crypto = require('crypto')

exports.createTempPassword = async ({ parentUserId, Username, password }) => {
  const TemporaryPassword = password || Username + 'a' + crypto.randomBytes(2).toString('hex').toLowerCase()

  const response = await client.send(new ListUsersCommand({
    UserPoolId: process.env.DRIVER_COGNITO_USER_POOOL_ID,
    Filter: `username = "${Username}"`,
    Limit: 1
  }))
  if (!response.Users.length) {
    const params = {
      TemporaryPassword,
      UserPoolId: process.env.DRIVER_COGNITO_USER_POOOL_ID,
      Username
    }
    const user = await client.send(new AdminCreateUserCommand(params))
    console.log(user)
    await dynamo.send(new PutItemCommand({
      TableName: process.env.DRIVER_USER_TABLE,
      Item: marshall({ id: Username.toLowerCase(), parentUserId })
    }))
    return this.createTempPassword({ parentUserId, Username, password })
  } else {
    const params = {
      Password: TemporaryPassword,
      UserPoolId: process.env.DRIVER_COGNITO_USER_POOOL_ID,
      Username: response.Users[0].Username,
      Permanent: true
    }
    await client.send(new AdminSetUserPasswordCommand(params))
  }
  return TemporaryPassword
}

exports.setCognitoPhoneNumber = async ({ Username, Value }) => {
  const response = await client.send(new ListUsersCommand({
    UserPoolId: process.env.DRIVER_COGNITO_USER_POOOL_ID,
    Filter: `username = "${Username}"`,
    Limit: 1
  }))

  if (response.Users.length) {
    return client.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: process.env.DRIVER_COGNITO_USER_POOOL_ID,
      Username,
      UserAttributes: [
        { Name: 'phone_number', Value },
        { Name: 'phone_number_verified', Value: 'true' }
      ]
    }))
  } else {
    console.log('ignoring phonenumber', Value, 'for username', Username)
  }
}
