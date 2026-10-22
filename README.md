# 🚗 Milemark - Vehicle Rental System (Express.js)

A complete beginner-friendly full-stack Express.js project featuring the modern **Milemark UI**, **custom & built-in middleware**, and full **RESTful CRUD APIs (GET, POST, PUT, DELETE)**.

---

## 📸 UI Design Match
The landing page faithfully reproduces the **Milemark** luxury car rental aesthetic:
- **Logo**: Circular ring with inner mark & `Milemark` brand
- **Hero Title**: Bold punchy `GRAB THE KEYS. SKIP THE COUNTER.`
- **Reservation Card**: `RESERVE A VEHICLE` (Form No. 07-A) with Pickup Location, Dates, and Vehicle Class dropdown
- **Live Fleet Catalog**: Dark luxury vehicle cards with specs, pricing, and live availability
- **Live Stats**: `486 vehicles ready today`, `19 city locations`, `4.8 avg. renter rating`

---

## 📁 File Structure
```text
vehicle-rental-system/
├── server.js          # Express.js server, middleware & REST API routes
├── package.json       # Project dependencies (Express)
├── README.md          # Project documentation
└── public/
    └── index.html     # Milemark frontend UI (HTML, CSS & dynamic JS)
```

---

## 🚀 How to Run

1. Open your terminal:
   ```bash
   cd "C:\Users\M AJITH KUMAR REDDY\.gemini\antigravity\scratch\vehicle-rental-system"
   ```
2. Start the server:
   ```bash
   node server.js
   ```
3. Open your browser:
   **[http://localhost:3000](http://localhost:3000)**

---

## 🛠️ Middleware Implemented

1. **`express.json()`**: Built-in middleware to parse incoming JSON request bodies.
2. **`express.static('public')`**: Built-in middleware to automatically serve the frontend web page and assets.
3. **Custom Logging Middleware**:
   ```javascript
   app.use((req, res, next) => {
     console.log(`[LOG] ${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
     next();
   });
   ```

---

## 📡 RESTful Endpoints (Full CRUD)

| Method | Endpoint | Description |
|---|---|---|
| **GET** | `/api/vehicles` | Retrieve fleet (supports filtering: `?type=Compact`) |
| **POST** | `/api/vehicles` | Add a new vehicle to fleet |
| **POST** | `/api/rent/:id` | Book a vehicle rental (marks `available = false`) |
| **PUT** | `/api/return/:id`| Return vehicle (marks `available = true`) |
| **DELETE** | `/api/vehicles/:id`| **Dynamically delete a vehicle by ID** |
| **GET** | `/api/rentals` | Retrieve active rentals list |
| **GET** | `/api/stats` | Retrieve fleet count metrics |
