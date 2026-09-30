namespace backend.Modules.Suppliers.DTOs;

public record SupplierDto(
    int Id,
    string SupplierCode,
    string Name,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string PaymentTerms,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc
);

public record CreateSupplierRequest(
    string SupplierCode,
    string Name,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string? PaymentTerms
);

public record UpdateSupplierRequest(
    string Name,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string? PaymentTerms,
    bool IsActive
);
