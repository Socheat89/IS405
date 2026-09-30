using System.Net;
using System.Net.Mail;

namespace backend.Services.Email;

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> SendInvitationEmailAsync(
        string toEmail,
        string username,
        string token,
        string setupUrl,
        CancellationToken cancellationToken = default)
    {
        var smtpHost = _configuration["Email:SmtpHost"] ?? Environment.GetEnvironmentVariable("SMTP_HOST") ?? "smtp.gmail.com";
        var smtpPortStr = _configuration["Email:SmtpPort"] ?? Environment.GetEnvironmentVariable("SMTP_PORT") ?? "587";
        var smtpUser = _configuration["Email:SmtpUser"] ?? Environment.GetEnvironmentVariable("SMTP_USER");
        var smtpPass = _configuration["Email:SmtpPass"] ?? Environment.GetEnvironmentVariable("SMTP_PASS");
        var fromAddress = _configuration["Email:FromAddress"] ?? Environment.GetEnvironmentVariable("FROM_ADDRESS");
        var fromDisplayName = _configuration["Email:FromName"] ?? "Mekong Stock ERP Security";

        // If fromAddress is not set or is dummy, use smtpUser if available
        if (string.IsNullOrWhiteSpace(fromAddress) || fromAddress.Contains("mekongstock.com"))
        {
            fromAddress = !string.IsNullOrWhiteSpace(smtpUser) ? smtpUser : "no-reply@mekongstock.com";
        }

        var htmlBody = GenerateInvitationHtml(username, setupUrl);
        var plainBody = $"Hello {username},\n\nYou have been invited to join Mekong Stock ERP.\nPlease click the link below to set up your password (valid for 24 hours):\n{setupUrl}\n\nIf you did not request this, please ignore this email.";

        // If SMTP is configured and host is not empty, try sending via SMTP
        if (!string.IsNullOrWhiteSpace(smtpHost) && int.TryParse(smtpPortStr, out var smtpPort))
        {
            try
            {
                using var client = new SmtpClient(smtpHost, smtpPort)
                {
                    EnableSsl = _configuration.GetValue<bool>("Email:EnableSsl", true),
                    UseDefaultCredentials = false,
                    DeliveryMethod = SmtpDeliveryMethod.Network,
                    Timeout = 15000
                };

                if (!string.IsNullOrWhiteSpace(smtpUser) && !string.IsNullOrWhiteSpace(smtpPass))
                {
                    client.Credentials = new NetworkCredential(smtpUser.Trim(), smtpPass.Trim());
                }

                using var mailMessage = new MailMessage
                {
                    From = new MailAddress(fromAddress, fromDisplayName),
                    Subject = "Welcome to Mekong Stock ERP - Set Up Your Password",
                    Body = htmlBody,
                    IsBodyHtml = true
                };

                mailMessage.To.Add(new MailAddress(toEmail.Trim(), username));

                await client.SendMailAsync(mailMessage, cancellationToken);
                _logger.LogInformation("✅ Invitation email successfully sent via SMTP to {ToEmail} for user {Username}", toEmail, username);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "⚠️ Failed to send invitation email via SMTP ({SmtpHost}:{SmtpPort}) to {ToEmail}. Fallback to simulated delivery.", smtpHost, smtpPort, toEmail);
            }
        }

        // In Development/Offline Mode or Fallback: Log email details cleanly
        _logger.LogInformation(
            "\n======================================================\n" +
            "📧 [INVITATION EMAIL DISPATCH TO: {ToEmail}]\n" +
            "👤 Username: {Username}\n" +
            "🔗 Password Setup Link: {SetupUrl}\n" +
            "⏰ Token expires in 24 hours\n" +
            "======================================================\n",
            toEmail, username, setupUrl);

        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine($"[EMAIL DISPATCH] Password Setup link for {toEmail}: {setupUrl}");
        Console.ResetColor();

        return true;
    }

    private static string GenerateInvitationHtml(string username, string setupUrl)
    {
        return $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Welcome to Mekong Stock ERP</title>
</head>
<body style=""margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;"">
    <table role=""presentation"" style=""width: 100%; border-collapse: collapse; padding: 40px 0;"">
        <tr>
            <td align=""center"">
                <table role=""presentation"" style=""width: 100%; max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); margin: 20px auto;"">
                    <!-- Header -->
                    <tr>
                        <td style=""background: linear-gradient(135deg, #155e89 0%, #2089C8 100%); padding: 40px 32px; text-align: center;"">
                            <h1 style=""color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;"">Mekong Stock ERP</h1>
                            <p style=""color: #e0f2fe; margin: 8px 0 0 0; font-size: 13px; font-weight: 500;"">Account Invitation & Password Setup</p>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style=""padding: 36px 32px;"">
                            <h2 style=""color: #0f172a; margin: 0 0 16px 0; font-size: 18px; font-weight: 700;"">Hello {WebUtility.HtmlEncode(username)},</h2>
                            <p style=""color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;"">
                                An administrator has created an account for you on <strong>Mekong Stock ERP</strong>. 
                                To activate your account and start using the system, please set your personal strong password.
                            </p>
                            
                            <table role=""presentation"" style=""width: 100%; margin: 28px 0;"">
                                <tr>
                                    <td align=""center"">
                                        <a href=""{setupUrl}"" style=""display: inline-block; background-color: #2089C8; color: #ffffff; text-decoration: none; padding: 14px 32px; font-size: 14px; font-weight: 700; border-radius: 12px; border: 1.5px solid #155e89; box-shadow: 0 4px 12px rgba(32, 137, 200, 0.3);"">
                                            Set Up Your Password →
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <div style=""background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 16px; margin: 24px 0;"">
                                <h3 style=""margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #0369a1; font-weight: 700; letter-spacing: 0.5px;"">Password Security Requirements:</h3>
                                <ul style=""margin: 0; padding-left: 20px; color: #0c4a6e; font-size: 12px; line-height: 1.6;"">
                                    <li>Minimum 8 characters</li>
                                    <li>At least one uppercase letter (A-Z)</li>
                                    <li>At least one lowercase letter (a-z)</li>
                                    <li>At least one numeric digit (0-9)</li>
                                    <li>At least one special symbol (!@#$%^&*)</li>
                                </ul>
                            </div>

                            <p style=""color: #64748b; font-size: 12px; line-height: 1.5; margin: 20px 0 0 0;"">
                                <em>Note: This invitation link is unique to your account and will expire in <strong>24 hours</strong>. If you cannot click the button above, copy and paste this link into your browser:</em>
                            </p>
                            <p style=""word-break: break-all; color: #2089C8; font-size: 11px; margin: 8px 0 0 0;"">
                                <a href=""{setupUrl}"" style=""color: #2089C8;"">{setupUrl}</a>
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style=""background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;"">
                            <p style=""color: #94a3b8; font-size: 11px; margin: 0;"">
                                &copy; {DateTime.UtcNow.Year} Mekong Stock Microservices System. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
    }
}
