# 🚌 Stop Alert

*Never miss your stop again.* Stop Alert is a GPS-based travel alert web app. Pick your destination, relax or sleep, and the app wakes you with a *loud alarm, vibration and a flashing screen* before you arrive. Built mainly for bus passengers in Sri Lanka, and works for vans, cars and trains too.

> ⚠️ *Status: Demo / Prototype (MVP).* This version proves the idea works. It uses sample routes and approximate coordinates and is not yet production-ready. See the [Roadmap](#-roadmap).

---

## 💡 The Problem

On long journeys, especially in an unfamiliar place, passengers fall asleep or do not know where to get off. They miss their stop, or the bus passes it before they can react.

## ✅ The Solution

1. The passenger chooses a route and a destination stop.
2. The phone tracks the live GPS location.
3. When the vehicle comes within the chosen distance of the stop, the app rings an *alarm, vibrates and flashes the screen*.

---

## ✨ Features

- 🗺️ Real Sri Lanka map (OpenStreetMap) with all sample bus routes drawn
- 🚌 Choose a route, then pick the stop from the list or by tapping it on the map
- 📏 Alert distance: 500 m, 1 km, 2 km, 3 km or 5 km (shown as a circle on the map)
- 📡 *Live GPS mode*: tracks your real position with distance, ETA and nearest stop
- 🎬 *Demo ride mode*: a simulated bus drives along the route so you can show the full alarm without travelling
- 🔔 Alarm with siren sound, vibration and full-screen flashing alert
- 📱 Screen stays awake during the trip (Wake Lock API)
- 🌙 Dark and light map styles
- 🕘 Trip history saved in MySQL (no login, random device id)

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Map | Leaflet + OpenStreetMap / CARTO tiles |
| Backend | PHP (PDO) |
| Database | MySQL |
| Local server | WAMP (Apache + PHP + MySQL) |
| Location | Browser Geolocation API |

## 📁 Project Structure


stop-alert/
├── index.html      # App page
├── css/
│   └── style.css   # Design
├── js/
│   └── app.js      # Map, GPS, demo ride, alarm
├── api.php         # JSON API (routes, trips, history)
├── config.php      # Database settings
├── database.sql    # MySQL schema + sample data
├── LICENSE
└── README.md


---

## 🚀 Getting Started (WAMP)

*Requirements:* WAMP (or XAMPP), and an internet connection for the map tiles.

1. Copy the stop-alert folder to C:\wamp64\www\
2. Start WAMP (the tray icon must be *green*)
3. Open http://localhost/phpmyadmin, go to the *Import* tab on the home page, choose database.sql and click *Import*. This creates the stop_alert database with tables and sample data.
4. Open *http://localhost/stop-alert/* in your browser

> Do not double-click index.html. PHP only works through http://localhost/....

*Configuration:* if your tables are in another database, or your MySQL root has a password, edit config.php:


🤝 Contributing

Ideas, bug reports and pull requests are welcome. Open an issue to discuss what you would like to change.

👤 Author

Chandrakumar Vishanan

	
	•	Email: chandrakumarvishanan0@gmail.com

📄 License

This project is licensed under the MIT License.

⭐ If you like this idea, give the repo a star!
