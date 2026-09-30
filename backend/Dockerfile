# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore NuGet dependencies
COPY ["backend.csproj", "./"]
RUN dotnet restore "backend.csproj"

# Build and publish application
COPY . .
RUN dotnet publish "backend.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Directory for SQLite database persistence
RUN mkdir -p /app/data

# Configure ASP.NET to listen on port 5000
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Development
EXPOSE 5000

COPY --from=build /app/publish .
COPY is405.db /app/is405.db

ENTRYPOINT ["dotnet", "backend.dll"]
