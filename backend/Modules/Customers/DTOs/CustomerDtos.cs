namespace backend.Modules.Customers.DTOs;

public record CustomerDto(
    int Id,
    string CustomerCode,
    string Name,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string CustomerType,
    decimal CreditLimit,
    string PaymentTerms,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc
);

public record CreateCustomerRequest(
    string CustomerCode,
    string Name,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string? CustomerType,
    decimal CreditLimit,
    string? PaymentTerms
);

public record UpdateCustomerRequest(
    string Name,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string? CustomerType,
    decimal CreditLimit,
    string? PaymentTerms,
    bool IsActive
);
