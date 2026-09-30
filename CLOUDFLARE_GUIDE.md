# 🌐 Cloudflare Tunnel Deployment Guide (IS405 ERP)

មគ្គុទ្ទេសក៍ពេញលេញអំពីការប្រើប្រាស់ **Cloudflare Tunnel** ដើម្បីផ្សាយប្រព័ន្ធ **Mekong Stock ERP** (Frontend + Backend API) ទៅកាន់ Internet ឱ្យ Team Member ប្រើប្រាស់ពីគ្រប់ទីកន្លែង ដោយមិនបាច់បង់ប្រាក់ និងមិនបាច់ដំឡើងអ្វីស្មុគស្មាញ!

---

## ⚡ វិធីសាស្ត្រទី ១: Quick Tunnel (Free ១០០% មិនបាច់មាន Account)

វិធីនេះលឿនបំផុត ចុចតែមួយភ្លែតបាន Public HTTPS Link ភ្លាមៗ៖

### ជំហានទី ១: Start Backend និង Frontend
1. **Backend (.NET API)**:
   ```powershell
   cd e:\is405\backend
   dotnet run
   ```
2. **Frontend (React Web App)**:
   ```powershell
   cd e:\is405\is405-frontend
   npm run dev
   ```

---

### ជំហានទី ២: បើក Cloudflare Tunnel សម្រាប់ Frontend
បើក **CMD ឬ PowerShell ថ្មី** រួចវាយពាក្យបញ្ជា៖

```cmd
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000
```

*(Cloudflare នឹងផ្តល់ Link មួយដូចជា `https://xxxx.trycloudflare.com`)*

---

### ជំហានទី ៣: (Optional) បើក Tunnel សម្រាប់ Backend Swagger API
ប្រសិនបើចង់ឱ្យ Team មើល និងតេស្ត Swagger API ផ្ទាល់៖
```cmd
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:5230
```

---

## 🏢 វិធីសាស្ត្រទី ២: Named Tunnel ជាមួយ Custom Domain (`mekongcyberunit.app`)

ប្រសិនបើអ្នកចង់ប្រើ Domain ផ្ទាល់ខ្លួនរបស់អ្នកតាមរយៈ Cloudflare Zero Trust Dashboard៖

### ១. ការកំណត់ Routes ក្នុង Cloudflare Dashboard:
ចូលទៅកាន់ **Zero Trust -> Networks -> Tunnels -> Routes** រួចកំណត់៖

| សេវាកម្ម | Subdomain | Domain | Service URL | Public URL ដែលទទួលបាន |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | `api` | `mekongcyberunit.app` | `http://localhost:5230` | `https://api.mekongcyberunit.app` |
| **Frontend App** | `app` (ឬទំនេរ) | `mekongcyberunit.app` | `http://localhost:3000` | `https://app.mekongcyberunit.app` |

---

### ២. ពាក្យបញ្ជា Run Connector លើ Windows (CMD Administrator):

- **Run ធម្មតា**:
  ```cmd
  "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run --token <TOKEN_របស់អ្នក>
  ```
- **ដំឡើងជា Windows Service (Run អូតូក្នុង Background រហូត)**:
  ```cmd
  "C:\Program Files (x86)\cloudflared\cloudflared.exe" service install <TOKEN_របស់អ្នក>
  ```

---

## 🔑 ព័ត៌មានគណនីសម្រាប់ Login (Admin Credentials)

| ប្រភេទគណនី | Username | Password | សិទ្ធិ (Role) |
| :--- | :--- | :--- | :--- |
| **Admin ពេញលេញ** | `admin` | `Password123!` | Administrator |
| **Admin (2FA TOTP)** | `admin_2fa` | `Password123!` | Secret: `JBSWY3DPEHPK3PXP` |

---

## 🛠️ ដោះស្រាយបញ្ហាដែលតែងជួប (Troubleshooting)

1. **ជួបបញ្ហា "Blocked request. This host is not allowed" (Vite)**:
   - ក្នុង `vite.config.js` ត្រូវមាន `server: { allowedHosts: true, host: true }` (បានកំណត់រួចហើយ)។
2. **ជួប 404 cPanel**:
   - ចូលទៅ Cloudflare DNS Records រួច **Delete A Record** របស់ `api.mekongcyberunit.app` ដែលចង្អុលទៅ cPanel ចាស់។
3. **កុំបិទផ្ទាំង Terminal**:
   - រាល់ពេលកំពុងប្រើ Quick Tunnel សូមកុំបិទផ្ទាំង CMD របស់ cloudflared (គ្រាន់តែ Minimize ទុក)។
