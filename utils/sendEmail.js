const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  try {
    if (!options.email || !options.subject || !options.message) {
      throw new Error("Email, subject, and message are required.");
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"Ground up" <${process.env.EMAIL_USER}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Email could not be sent.");
  }
};

module.exports = sendEmail;
