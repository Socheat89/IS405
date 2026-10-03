# 🐳 IS405 ERP System - Docker Hub & Server Deployment Guide

ការណែនាំលម្អិតអំពីរបៀប **Build & Push Docker Images ទៅកាន់ Docker Hub** និង **Pull យកទៅ Deploy លើ Server (VPS)** ជាមួយ **Oracle Database**។

---

## 📑 តារាងមាតិកា
1. [ផ្នែកទី ១៖ Build & Push ទៅ Docker Hub (លើម៉ាស៊ីន Local)](#ផ្នែកទី-១-build--push-ទៅ-docker-hub-លើម៉ាស៊ីន-local)
2. [ផ្នែកទី ២៖ Setup & Deploy លើ Server ថ្មី](#ផ្នែកទី-២-setup--deploy-លើ-server-ថ្មី)
3. [ផ្នែកទី ៣៖ ព័ត៌មាន Login & Database](#ផ្នែកទី-៣-ព័ត៌មាន-login--database)
4. [ផ្នែកទី ៤៖ Commands សំខាន់ៗសម្រាប់គ្រប់គ្រងលើ Server](#ផ្នែកទី-៤-commands-សំខាន់ៗសម្រាប់គ្រប់គ្រងលើ-server)

---

## ផ្នែកទី ១៖ Build & Push ទៅ Docker Hub (លើម៉ាស៊ីន Local)

> 💡 **ចំណាំ**៖ សូមបើក **Docker Desktop** លើកុំព្យូទ័ររបស់អ្នកជាមុនសិន។

### ១. Login ចូល Docker Hub លើ Terminal:
```bash
docker login
```
*(វាយ username និង password របស់គណនី Docker Hub របស់អ្នក ឧទាហរណ៍៖ `socheat29`)*

### ២. Build Backend Image:
```bash
# នៅក្នុង Root Directory (e:\is405)
docker build -t socheat29/backend:latest ./backend
```

### ៣. Build Frontend Image:
```bash
docker build -t socheat29/frontend:latest ./is405-frontend
```

### ៤. Push Images ទៅ Docker Hub:
```bash
docker push socheat29/backend:latest
docker push socheat29/frontend:latest
```

*(បើអ្នកចង់ប្រើ Oracle Database Image ផ្ទាល់ខ្លួន អាចប្រើ `gvenzl/oracle-xe:21-slim-faststart` ឬ pull រួច push ទៅ Docker Hub ជា `socheat29/oracle:latest`)*

---

## ផ្នែកទី ២៖ Setup & Deploy លើ Server ថ្មី

### ១. ភ្ជាប់ទៅកាន់ Server របស់អ្នក (SSH):
```bash
ssh root@<IP_អាសយដ្ឋាន_SERVER_របស់អ្នក>
```

### ២. ដំឡើង Docker & Docker Compose លើ Server (បើជា Ubuntu/Debian):
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# ដំឡើង Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# ដំឡើង Docker Compose Plugin
sudo apt install -y docker-compose-plugin
```

### ៣. បង្កើត Folder សម្រាប់ Project លើ Server:
```bash
mkdir -p ~/is405-app
cd ~/is405-app
```

### ៤. បង្កើត File `docker-compose.yml` លើ Server:
វាយ `nano docker-compose.yml` រួច Paste Code ខាងក្រោមចូល៖

```yaml
services:
  oracle:
    image: gvenzl/oracle-xe:21-slim-faststart
    container_name: is405_oracle
    ports:
      - "3333:1521"
    environment:
      - ORACLE_PASSWORD=123
      - APP_USER=system
      - APP_USER_PASSWORD=123
    volumes:
      - oracle_data:/opt/oracle/oradata
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
      - ASPNETCORE_ENVIRONMENT=Production
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
      - "80:80"
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  oracle_data:
```
*(ចុច `Ctrl + O` រួច `Enter` ដើម្បី Save និង `Ctrl + X` ដើម្បីចាកចេញពី Nano)*

### ៥. Pull Images និង Start Containers:
```bash
docker compose pull
docker compose up -d
```

> ⏳ **ចំណាំ**៖ នៅពេល Run លើកដំបូង Oracle Database ត្រូវការពេលប្រហែល **៣០ ទៅ ៦០ វិនាទី** ដើម្បី Initialize និងបង្កើត Table។ Backend នឹងរង់ចាំរហូតដល់ Oracle Healthy ទើបចាប់ផ្ដើមដោយស្វ័យប្រវត្តិ។

---

## ផ្នែកទី ៣៖ ព័ត៌មាន Login & Database

### 🌐 អាសយដ្ឋានចូលប្រើប្រាស់ (Access URLs):
- 💻 **Frontend Web App**: `http://<IP_SERVER_របស់អ្នក>` ឬ `http://<IP_SERVER_របស់អ្នក>:3000`
- ⚙️ **Backend API (Swagger Docs)**: `http://<IP_SERVER_របស់អ្នក>:5230/swagger`
- 🗄️ **Oracle Database Connection**:
  - Host: `<IP_SERVER_របស់អ្នក>`
  - Port: `3333`
  - Service Name: `XEPDB1`
  - User: `system`
  - Password: `123`

### 🔑 គណនី Admin សម្រាប់ Login:
| ប្រភេទគណនី | Username | Password | សិទ្ធិ (Role) |
| :--- | :--- | :--- | :--- |
| **Admin (Standard)** | `admin` | `Password123!` | Administrator |
| **Admin (2FA)** | `admin_2fa` | `Password123!` | Administrator (Secret: `JBSWY3DPEHPK3PXP`) |

---

## ផ្នែកទី ៤៖ Commands សំខាន់ៗសម្រាប់គ្រប់គ្រងលើ Server

- **ពិនិត្យ Status នៃ Containers**:
  ```bash
  docker compose ps
  ```

- **មើល Logs របស់ Backend / Frontend / Oracle**:
  ```bash
  docker compose logs -f backend
  docker compose logs -f oracle
  ```

- **Update កូដថ្មី (ពេល push កូដថ្មីទៅ Docker Hub រួច)**:
  ```bash
  docker compose pull
  docker compose up -d
  ```

- **បញ្ឈប់ Containers (Stop)**:
  ```bash
  docker compose down
  ```
