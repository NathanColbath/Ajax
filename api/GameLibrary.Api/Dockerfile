# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY GameLibrary.Api.csproj .
RUN dotnet restore GameLibrary.Api.csproj

COPY . .
RUN dotnet publish GameLibrary.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

RUN mkdir -p /data/files

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    ConnectionStrings__Default="Data Source=/data/gamelibrary.db" \
    Storage__RootPath=/data/files

EXPOSE 8080

ENTRYPOINT ["dotnet", "GameLibrary.Api.dll"]
