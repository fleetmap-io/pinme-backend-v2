const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { Upload } = require('@aws-sdk/lib-storage')
const REGION = 'us-east-1'
const s3Client = new S3Client({ region: REGION })
const zlib = require('zlib')
const gz = zlib.createGzip()

exports.put = async (Key, Body, ContentType = 'application/json', compress = true, Bucket = process.env.S3_BUCKET) => await s3Client.send(new PutObjectCommand({
  Bucket,
  Key,
  Body: compress ? zlib.gzipSync(Body) : Body,
  ACL: 'public-read',
  ContentType,
  ...(compress ? { ContentEncoding: 'gzip' } : {})
}))

exports.upload = async (Key, stream) => {
  await new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.S3_BUCKET,
      Key,
      Body: stream.pipe(gz),
      ContentEncoding: 'gzip',
      ContentType: 'application/json'
    }
  }).done()
}
