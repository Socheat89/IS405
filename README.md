# ⚡ Mekong Stock ERP (IS405 Project)

ប្រព័ន្ធគ្រប់គ្រងស្តុក ទំនិញទិញចូល-លក់ចេញ (Inventory, Purchase Orders, Sales & Microservices Management System) ដំណើរការដោយ **.NET 10 Web API**, **React (Vite) Frontend** និងផ្សាយចេញទៅកាន់ Internet តាមរយៈ **Cloudflare Tunnel (Free & HTTPS Secure)**។

---

## 🚀 របៀបដំណើរការជាមួយ Cloudflare Tunnel (Step-by-Step)

ដើម្បីដំណើរការប្រព័ន្ធ និងផ្សាយទៅកាន់ Online ឱ្យ Team Member ប្រើប្រាស់បានភ្លាមៗ សូមអនុវត្តតាម ៣ ជំហានងាយៗខាងក្រោម៖

### 📌 ជំហានទី ១: Start Backend (.NET API)
បើក **Terminal ទី ១** (PowerShell ឬ CMD) រួចវាយ៖
```powershell
cd e:\is405\backend
dotnet run
```
*(Backend នឹងដំណើរការលើ Local Port `5230`)*

---

### 📌 ជំហានទី ២: Start Frontend (React Web App)
បើក **Terminal ទី ២** រួចវាយ៖
```powershell
cd e:\is405\is405-frontend
npm run dev
```
*(Frontend នឹងដំណើរការលើ Local Port `3000`)*

---

### 📌 ជំហានទី ៣: បើក Cloudflare Quick Tunnel (Free ១០០%)
បើក **Terminal ទី ៣** (CMD ឬ PowerShell) រួចវាយពាក្យបញ្ជា៖

```cmd
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000
```

*(Cloudflare នឹងផ្តល់ជូន Public HTTPS Link មួយភ្លាមៗ ដូចជា៖ `https://xxxx.trycloudflare.com`)*

---

## 🔑 ព័ត៌មានគណនីសម្រាប់ Login (Admin Credentials)

ប្រព័ន្ធបានបង្កើតគណនី Admin និងសិទ្ធិទាំងអស់រួចជាស្រេច៖

| ប្រភេទគណនី | Username | Password | សិទ្ធិ / Role | ចំណាំ |
| :--- | :--- | :--- | :--- | :--- |
| **Admin ពេញលេញ** | `admin` | `Password123!` | Administrator (Full Access) | ប្រើសម្រាប់ Login ទូទៅ |
| **Admin (2FA TOTP)** | `admin_2fa` | `Password123!` | Administrator (Full Access) | Secret: `JBSWY3DPEHPK3PXP` |

---

## 🌐 អាសយដ្ឋានសម្រាប់ចូលប្រើប្រាស់ (Access URLs)

- 💻 **Frontend Web App (Online)**: Public Link ទទួលបានពី Cloudflare Tunnel (ជំហានទី ៣)
- 💻 **Frontend Web App (Local)**: [http://localhost:3000](http://localhost:3000)
- ⚙️ **Backend API (Swagger Docs)**: [http://localhost:5230/swagger](http://localhost:5230/swagger)

---

## 🛠️ ចំណាំសំខាន់ៗ (Important Notes)

1. **រក្សាទុកផ្ទាំង Terminal**:
   - សូមកុំបិទផ្ទាំង Terminal ទាំង ៣ (គ្រាន់តែ Minimize ទុក) ដើម្បីឱ្យប្រព័ន្ធនៅតែបន្តដំណើរការលើ Online ជាធម្មតា។
2. **សម្រាប់ Team Member**:
   - សមាជិកក្រុមមិនបាច់ដំឡើងអ្វីទាំងអស់ គ្រាន់តែអ្នកផ្ញើ Link `https://xxxx.trycloudflare.com` ទៅឱ្យពួកគាត់ គឺអាចបើក Login ប្រើប្រាស់បានភ្លាមៗ!
