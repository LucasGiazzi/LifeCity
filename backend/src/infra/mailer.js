const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

exports.sendPasswordResetEmail = async (to, code) => {
  await transporter.sendMail({
    from: `"LifeCity" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Redefinição de senha — LifeCity',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2E4057; margin-bottom: 8px;">Redefinição de senha</h2>
        <p style="color: #444;">Você solicitou a redefinição da sua senha no <strong>LifeCity</strong>.</p>
        <p style="color: #444;">Use o código abaixo no aplicativo. Ele expira em <strong>15 minutos</strong>.</p>
        <div style="font-size: 40px; font-weight: bold; letter-spacing: 12px; text-align: center;
                    padding: 28px 20px; background: #f0f4ff; border-radius: 12px; margin: 24px 0;
                    color: #2E4057; border: 2px solid #c7d4f5;">
          ${code}
        </div>
        <p style="color: #999; font-size: 13px;">Se você não solicitou a redefinição de senha, ignore este e-mail com segurança.</p>
      </div>
    `,
  });
};
