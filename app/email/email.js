const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
const MailComposer = require('nodemailer/lib/mail-composer')
const sesV2 = new SESv2Client({ region: 'us-east-1' })


exports.email = (to, bcc, html, subject, source, ContactListName = 'default', TopicName = 'Alerts',
  unsubscribeText = 'To stop receiving these emails') => {
  html += `<br><br><small>${unsubscribeText}, <a href="{{amazonSESUnsubscribeUrl}}">unsubscribe</a>.</small>`
  const params = {
    ListManagementOptions: {
      ContactListName,
      TopicName
    },
    Destination: {
      ToAddresses: to
    },
    Content: {
      Simple: {
        Body: {
          Html: {
            Data: html
          }
        },
        Subject: {
          Data: subject
        }
      }
    },
    FromEmailAddress: source
  }
  console.log('sending to', to, 'subject', subject)
  return sesV2.sendEmail(params).promise()
}

async function sendOne (html, unsubscribeText, source, to, subject, attachments, ContactListName, TopicName) {
  html += `<br><br><small>${unsubscribeText}, <a href="{{amazonSESUnsubscribeUrl}}">unsubscribe</a>.</small>`
  const mailOptions = {
    from: source,
    to,
    subject: '=?utf-8?b?' + Buffer.from(subject).toString('base64') + '?=',
    html,
    attachments
  }
  const mimeMessage = new MailComposer(mailOptions)
  const Data = await mimeMessage.compile().build()
  console.log('sending to ', to, 'from', source)
  const params = {
    ListManagementOptions: {
      ContactListName,
      TopicName
    },
    Content: {
      Raw: { Data }
    },
    FromEmailAddress: source
  }

  return sesV2.sendEmail(params).promise()
}

exports.emailWithAttachment = async (to, bcc, html, subject, source, attachments, ContactListName = 'default', TopicName = 'Reporting',
  unsubscribeText = 'To stop receiving these emails') => {
  for (const t of to) {
    await sendOne(html, unsubscribeText, source, [t], subject, attachments, ContactListName, TopicName)
  }
  for (const t of bcc) {
    await sendOne(html, unsubscribeText, source, [t], subject, attachments, ContactListName, TopicName)
  }
}

exports.validateEmail = (email) => {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  return re.test(String(email).toLowerCase())
}
