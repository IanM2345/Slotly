

 import formData from 'form-data';
 import Mailgun from 'mailgun.js';

 const mailgun = new Mailgun(formData);
 const mg = mailgun.client({
  username: 'api',
   key: process.env.MAILGUN_API_KEY,
 });

export async function sendEmail({ to, subject, html }) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV EMAIL MOCK] ➜ To: ${to}\nSubject: ${subject}\nHTML:\n${html}`);
    return;
  }

  
  return mg.messages.create(process.env.MAILGUN_DOMAIN, {
    from: `Slotly <no-reply@${process.env.MAILGUN_DOMAIN}>`,
    to,
    subject,
    html,
  });
}
