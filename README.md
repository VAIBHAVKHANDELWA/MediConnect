# MediConnect – Hospital Resource Sharing & Referral System

MediConnect is a web-based platform designed to help hospitals efficiently manage and share critical medical resources in real time.  
It enables seamless coordination between hospitals for patient referrals, ensuring timely access to life-saving facilities.

---

## 🌐 Live Demo
👉 https://hospital-admin-project-mvnd.vercel.app/

---

## 🧠 Key Features

- 🏥 Real-time monitoring of hospital resources  
  *(ICU beds, blood units, oxygen, etc.)*  
- 🔍 Cross-hospital resource discovery  
- 🤝 Smart referral system between hospitals  
- 📅 Resource reservation to prevent double-booking  
- 🔐 Authentication using firebase & hospital registration system  
- 🔔 Notification workflows for updates and actions  
- 🔄 Manual backup & synchronization for fault recovery  
- ⚙️ Consistent state management across workflows  

---

## ⚙️ Tech Stack

- **React.js** – Frontend framework  
- **Tailwind CSS** – Styling  
- **Axios** – API communication  
- **Backend** - Firebase
- **Vercel** – Deployment  

---

## 🔑 Core Functionalities

### 🏥 Resource Management
- Track availability of ICU beds, oxygen, and blood units  
- Update resources dynamically  
- Centralized dashboard for hospital admins  

---

### 🤝 Referral System
- Locate hospitals with available resources  
- Redirect patients efficiently  
- Ensure smooth inter-hospital coordination  

---

### 📅 Reservation Logic
- Pre-book required resources during referral  
- Prevent double-booking conflicts  
- Guarantee availability before transfer  

---

### 🔐 Authentication & Access Control
- Secure login system  
- Hospital registration flow  
- Role-based access handling  

---

### 🔔 Notifications
- Alerts for referrals and updates  
- Status tracking for actions  
- Improved coordination between hospitals  

---

### 🔄 Backup & Synchronization
- Manual backup system  
- Data recovery support  
- Ensures system reliability during failures  

---

## 🏗️ Project Structure

```bash
src/
├── components/
├── pages/
├── context/
├── services/
├── utils/
├── App.js
└── index.js

⚙️ Setup Instructions
1. Clone the repository
git clone https://github.com/your-username/mediconnect.git
cd mediconnect
2. Install dependencies
npm install
3. Configure environment variables

Create a .env file:

REACT_APP_BACKEND_URL=your_backend_url_here
4. Run the application
npm start


⚠️ Notes
Designed for hospital admin use cases
Focuses on resource optimization and emergency response
Manual sync ensures reliability during system failures

💡 Future Improvements
Real-time updates using WebSockets
AI-based resource prediction
Integration with government health APIs

👨‍💻 Author
Naman Pandit
GitHub: https://github.com/Pandit2508

🧾 License

This project is licensed under the MIT License.
