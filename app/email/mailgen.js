const Mailgen = require('mailgen');
const mail = require('./email');

function sendEmail(to, bcc, rows, eMail, subject, source, productName, link, logo) {
    return mail.email(
      to,
      bcc,
      new Mailgen({
        theme: 'default',
        product: {
          // Appears in header & footer of e-mails
          name: productName,
          link: link,
          logo: logo
        }
      }).generate(eMail),
      subject,
      source
    );
}

exports.sendEmail = sendEmail;
