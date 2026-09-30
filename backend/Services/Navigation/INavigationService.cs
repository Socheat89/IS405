using backend.Models.Request;

namespace backend.Services.Navigation;

public interface INavigationService
{
    Task<IReadOnlyList<NavigationItemResponse>>
        GetUserNavigationAsync(
            int userId,
            CancellationToken cancellationToken);
}
