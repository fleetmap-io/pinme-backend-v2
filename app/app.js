const axios = require('axios')
const url = 'http://checkip.amazonaws.com/';
let response;

exports.lambdaHandler = async () => {
    try {
        const ret = await axios(url).then(d => d.data);
        response = {
            'statusCode': 200,
            'body': JSON.stringify({
                message: 'hello world',
                location: ret.trim()
            })
        }
    } catch (err) {
        console.log(err);
        return err;
    }

    return response
};
