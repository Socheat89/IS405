using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;

namespace backend.Services.QrAuth;

public class TrustedDeviceService : ITrustedDeviceService
{
    private readonly ConcurrentDictionary<string, TrustedDeviceRecord> _devices = new();
    private readonly string _storageFilePath;
    private readonly SemaphoreSlim _fileLock = new(1, 1);
    private bool _isLoaded;

    public TrustedDeviceService()
    {
        // Choose persistence folder
        string dataDir = Directory.Exists("/app/data")
            ? "/app/data"
            : Path.Combine(AppContext.BaseDirectory, "data");

        try
        {
            Directory.CreateDirectory(dataDir);
        }
        catch
        {
            dataDir = AppContext.BaseDirectory;
        }

        _storageFilePath = Path.Combine(dataDir, "trusted_devices.json");
        LoadFromFile();
    }

    private void LoadFromFile()
    {
        if (_isLoaded) return;

        try
        {
            if (File.Exists(_storageFilePath))
            {
                var json = File.ReadAllText(_storageFilePath);
                var list = JsonSerializer.Deserialize<List<TrustedDeviceRecord>>(json);
                if (list != null)
                {
                    foreach (var item in list)
                    {
                        if (!string.IsNullOrWhiteSpace(item.DeviceId))
                        {
                            _devices[item.DeviceId] = item;
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TrustedDeviceService] Notice: Could not read trusted devices file: {ex.Message}");
        }
        finally
        {
            _isLoaded = true;
        }
    }

    private async Task SaveToFileAsync()
    {
        await _fileLock.WaitAsync();
        try
        {
            var list = _devices.Values.ToList();
            var json = JsonSerializer.Serialize(list, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(_storageFilePath, json);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TrustedDeviceService] Warning: Could not write trusted devices file: {ex.Message}");
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public async Task<TrustedDeviceRecord?> ValidateDeviceAsync(string deviceId, string deviceSecret, string? ipAddress)
    {
        if (string.IsNullOrWhiteSpace(deviceId) || string.IsNullOrWhiteSpace(deviceSecret))
        {
            return null;
        }

        if (_devices.TryGetValue(deviceId.Trim(), out var record))
        {
            if (record.IsRevoked) return null;

            // Constant-time compare or direct match
            if (string.Equals(record.DeviceSecret, deviceSecret.Trim(), StringComparison.Ordinal))
            {
                record.LastUsedAtUtc = DateTimeOffset.UtcNow;
                if (!string.IsNullOrEmpty(ipAddress))
                {
                    record.LastIpAddress = ipAddress;
                }

                _ = Task.Run(SaveToFileAsync);
                return record;
            }
        }

        return null;
    }

    public async Task<TrustedDeviceRecord> RegisterDeviceAsync(
        int userId,
        string username,
        string email,
        string? deviceName,
        string? ipAddress)
    {
        var randomIdBytes = new byte[16];
        RandomNumberGenerator.Fill(randomIdBytes);
        var deviceId = "dev_" + Convert.ToHexString(randomIdBytes).ToLowerInvariant();

        var randomSecBytes = new byte[32];
        RandomNumberGenerator.Fill(randomSecBytes);
        var deviceSecret = "sec_" + Convert.ToBase64String(randomSecBytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');

        var now = DateTimeOffset.UtcNow;
        var record = new TrustedDeviceRecord
        {
            DeviceId = deviceId,
            DeviceSecret = deviceSecret,
            UserId = userId,
            Username = username,
            Email = email,
            DeviceName = string.IsNullOrWhiteSpace(deviceName) ? "Mobile Device" : deviceName.Trim(),
            LastIpAddress = ipAddress,
            CreatedAtUtc = now,
            LastUsedAtUtc = now,
            IsRevoked = false
        };

        _devices[deviceId] = record;
        await SaveToFileAsync();

        return record;
    }

    public async Task<bool> RevokeDeviceAsync(string deviceId, string? deviceSecret)
    {
        if (string.IsNullOrWhiteSpace(deviceId)) return false;

        if (_devices.TryGetValue(deviceId.Trim(), out var record))
        {
            if (!string.IsNullOrEmpty(deviceSecret) && !string.Equals(record.DeviceSecret, deviceSecret.Trim(), StringComparison.Ordinal))
            {
                return false;
            }

            record.IsRevoked = true;
            await SaveToFileAsync();
            return true;
        }

        return false;
    }
}
