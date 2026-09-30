# 🐳 IS405 ERP System - Docker Deployment Guide (សម្រាប់សមាជិកក្រុម)

ការណែនាំលម្អិតសម្រាប់សមាជិកក្រុមយកទៅ Run Test ដោយមិនបាច់ដំឡើង Oracle Database, .NET SDK ឬ Node.js លើម៉ាស៊ីនផ្ទាល់ឡើយ។ គ្រាន់តែមាន **Docker Desktop** គឺអាចដំណើរការបានភ្លាមៗ!

---

## 📋 តម្រូវការជាមុន (Prerequisites)
1. **Docker Desktop** (ត្រូវប្រាកដថាបានបើកដំណើរការ - Engine Status: **Running 🟢**)

---

## 🚀 ជំហានដំណើរការ (Setup Steps)

### ជំហានទី ១: បង្កើត file មួយឈ្មោះ `docker-compose.yml`
ចម្លង Code ខាងក្រោមដាក់ក្នុង file `docker-compose.yml` ក្នុង Folder ណាមួយ៖

```yaml
services:
  oracle:
    image: socheat29/oracle:latest
    container_name: is405_oracle
    ports:
      - "3333:1521"
    environment:
      - ORACLE_PASSWORD=123
      - APP_USER=system
      - APP_USER_PASSWORD=123
    healthcheck:
      test: ["CMD-SHELL", "echo 'exit' | sqlplus -L system/123@localhost:1521/XEPDB1"]
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 30s
    restart: unless-stopped

  backend:
    image: socheat29/backend:latest
    container_name: is405_backend
    ports:
      - "5230:5000"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=http://+:5000
      - DatabaseProvider=Oracle
      - ConnectionStrings__OracleConnection=Data Source=oracle:1521/XEPDB1;User Id=system;Password=123;
    depends_on:
      oracle:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    image: socheat29/frontend:latest
    container_name: is405_frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped
```

---

### ជំហានទី ២: Pull Images និង Start Containers
បើក Terminal (Command Prompt ឬ PowerShell) នៅក្នុង Folder នោះ រួចវាយ៖

```bash
docker compose pull
docker compose up -d
```

> ⏳ **ចំណាំសំខាន់**៖ លើកដំបូង Oracle Database ត្រូវការពេលប្រហែល **៣០ ទៅ ៦០ វិនាទី** ដើម្បី Initialize និងឡើង Healthy មុនពេល Backend ចាប់ផ្ដើម។ សូមរង់ចាំបន្តិចមុនពេលបើក Web Browser។

---

### ជំហានទី ៣: ពិនិត្យ Status
ដើម្បីដឹងថា Services ទាំងអស់ដំណើរការបានជោគជ័យឬនៅ សូមវាយ៖
```bash
docker compose ps
```
*(ប្រសិនបើឃើញ `is405_oracle (healthy)`, `is405_backend (Up)`, `is405_frontend (Up)` គឺរួចរាល់ ១០០%)*

---

## 🔑 ព័ត៌មានគណនីសម្រាប់ Login (Admin Credentials)

| ប្រភេទគណនី | Username | Password | សិទ្ធិ (Role) |
| :--- | :--- | :--- | :--- |
| **Admin (ស្តង់ដារ)** | `admin` | `Password123!` | Administrator (ពេញលេញ) |
| **Admin (2FA)** | `admin_2fa` | `Password123!` | Administrator (Secret: `JBSWY3DPEHPK3PXP`) |

---

## 🌐 អាសយដ្ឋានសម្រាប់ចូលប្រើប្រាស់ (Access URLs)

- 💻 **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
- ⚙️ **Backend API (Swagger Docs)**: [http://localhost:5230/swagger](http://localhost:5230/swagger)
- 🗄️ **Oracle Database Port**: `localhost:3333`
  - **Service Name**: `XEPDB1`
  - **Username**: `system`
  - **Password**: `123`

---

## 🛠️ ដោះស្រាយបញ្ហា (Troubleshooting)

- **ជួបបញ្ហា "Cannot connect to backend server"**:
  - មូលហេតុ៖ Backend មិនទាន់ Start ទាន់ ឬ Oracle មិនទាន់ Healthy។
  - ដំណោះស្រាយ៖ រង់ចាំប្រហែល ៣០ វិនាទី រួចចុច Refresh (F5) លើ Browser ឬវាយ `docker compose restart backend`។
- **ចង់បញ្ឈប់/បិទ Services (Stop)**:
  ```bash
  docker compose down
  ```
