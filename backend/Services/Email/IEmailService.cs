namespace backend.Services.Email;

public interface IEmailService
{
    /// <summary>
    /// Sends an invitation email to a newly created user with a secure setup link to set their own password.
    /// </summary>
    Task<bool> SendInvitationEmailAsync(
        string toEmail,
        string username,
        string token,
        string setupUrl,
        CancellationToken cancellationToken = default);
}
