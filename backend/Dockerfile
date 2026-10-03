# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend.csproj ./
RUN dotnet restore backend.csproj
COPY . ./
RUN dotnet publish backend.csproj -c Release -o /app/publish --no-restore

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Directory for SQLite database persistence
RUN mkdir -p /app/data

ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 5000

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "backend.dll"]
