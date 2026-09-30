# ⚡ Mekong Stock ERP (IS405 Project)

ប្រព័ន្ធគ្រប់គ្រងស្តុក ទំនិញទិញចូល-លក់ចេញ (Inventory, Purchase Orders, Sales & Microservices Management System) ដំណើរការដោយ Oracle Database, .NET 10 Web API Backend និង React Frontend។

---

## 👥 ការណែនាំដំណើរការសម្រាប់ Team Member (មិនបាច់មាន Code)

សមាជិកក្រុមមិនចាំបាច់ដំឡើង Oracle Database, .NET SDK ឬ Node.js លើកុំព្យូទ័រឡើយ។ គ្រាន់តែមាន **Docker Desktop** គឺអាច Run ប្រព័ន្ធទាំងមូលបានភ្លាមៗ។

### 📋 លក្ខខណ្ឌតម្រូវ (Prerequisites)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (ដំឡើងរួចបើកដំណើរការ Engine ឱ្យចេញពណ៌បៃតង 🟢)

---

### 🚀 ជំហានដំណើរការ (Quick Start)

#### ជំហានទី ១: រៀបចំ Folder និង file `docker-compose.yml`
1. បង្កើត Folder ថ្មីមួយលើកុំព្យូទ័រ (ឧទាហរណ៍៖ `Desktop/is405-app`)
2. បង្កើត file មួយឈ្មោះ `docker-compose.yml` នៅក្នុង Folder នោះ រួចចម្លង Code ខាងក្រោមដាក់ចូល៖

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

#### ជំហានទី ២: Pull និង Run Containers
បើក Terminal (PowerShell ឬ Command Prompt) នៅក្នុង Folder នោះ រួចវាយ៖

```bash
docker compose pull
docker compose up -d
```

> ⏳ **ចំណាំសំខាន់**៖ នៅពេល Run លើកដំបូង Oracle Database ត្រូវការពេលប្រហែល **៣០ ទៅ ៦០ វិនាទី** ដើម្បី Initialize និងឡើង Healthy មុនពេល Backend ចាប់ផ្ដើមដំណើរការ។ សូមរង់ចាំបន្តិចមុនពេលបើក Web Browser។

---

#### ជំហានទី ៣: ពិនិត្យ Status
ដើម្បីផ្ទៀងផ្ទាត់ថា Containers ទាំងអស់ដំណើរការស្រួល៖
```bash
docker compose ps
```
*(នៅពេលឃើញ `is405_oracle (healthy)`, `is405_backend (Up)`, `is405_frontend (Up)` គឺរួចរាល់)*

---

## 🔑 គណនីសម្រាប់ Login (Admin Credentials)

ប្រព័ន្ធបាន Seed ទិន្នន័យ Admin និងសិទ្ធិទាំងអស់ចូល Database រួចជាស្រេច៖

| ប្រភេទគណនី | Username | Password | សិទ្ធិ / Role | ចំណាំ |
| :--- | :--- | :--- | :--- | :--- |
| **Admin ធម្មតា** | `admin` | `Password123!` | Administrator (ពេញលេញ) | ប្រើសម្រាប់ Login ទូទៅ |
| **Admin (2FA)** | `admin_2fa` | `Password123!` | Administrator (ពេញលេញ) | Secret Key: `JBSWY3DPEHPK3PXP` |

---

## 🌐 អាសយដ្ឋានសម្រាប់ចូលប្រើប្រាស់ (Access URLs)

- 💻 **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
- ⚙️ **Backend API (Swagger Docs)**: [http://localhost:5230/swagger](http://localhost:5230/swagger)
- 🗄️ **Oracle Database**: `localhost:3333`
  - **Service Name**: `XEPDB1`
  - **User**: `system`
  - **Password**: `123`

---

## 🛠️ ដោះស្រាយបញ្ហា (Troubleshooting)

### ❓ Error: "Cannot connect to backend server"
- **មូលហេតុ**៖ បើក Web Browser លឿនពេក ខណៈពេល Oracle Database កំពុង Boot មិនទាន់ Healthy ធ្វើឱ្យ Backend មិនទាន់ចាប់ផ្ដើម។
- **ដំណោះស្រាយ**៖ 
  1. រង់ចាំប្រហែល ៣០ វិនាទី រួចចុច **Refresh (F5)** លើ Browser។
  2. ឬវាយ Restart Backend តាម Terminal:
     ```bash
     docker compose restart backend
     ```

### ❓ បិទ ឬ Stop Containers
```bash
docker compose down
```
