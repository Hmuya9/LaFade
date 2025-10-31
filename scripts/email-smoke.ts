import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

async function main() {
  try {
    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'lafade487@gmail.com',
      to: 'hmuya@uw.edu',  // receiver email
      subject: '✅ LaFade Email Smoke Test',
      html: `
        <h2>It works 🎉</h2>
        <p>Your Resend + LaFade email pipeline is live!</p>
        <p><strong>From:</strong> ${process.env.EMAIL_FROM}</p>
        <p><strong>App URL:</strong> ${process.env.NEXT_PUBLIC_APP_URL}</p>
      `
    })

    console.log('✅ Email sent successfully!')
    console.log(response)
  } catch (error) {
    console.error('❌ Error sending email:', error)
  }
}

main()
