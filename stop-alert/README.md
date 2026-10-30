# Stop Alert

Sleep easy on long journeys. Pick your destination stop and Stop Alert wakes you with a loud alarm, vibration and a flashing screen before you get there. Built for bus passengers in Sri Lanka, works for vans, cars and trains too.

> Status: demo / prototype. Sample stops and routes only, coordinates are approximate.

## Features

- Real Sri Lanka map (OpenStreetMap) with all sample bus routes drawn
- Choose route, then tap a stop in the list or on the map
- Alarm distance: 500 m, 1 km, 2 km, 3 km, 5 km (shown as a circle on the map)
- **Live GPS** mode: tracks your real position, shows distance, ETA and nearest stop
- **Demo ride** mode: a pretend bus drives along the route so you can show the full alarm without travelling
- Alarm: siren sound + vibration + full-screen flashing alert
- Screen stays on during the trip (wake lock)
- Trip history saved in MySQL (no login, random device id)

## Tech

HTML, CSS, JavaScript (Leaflet map), PHP (PDO) and MySQL. No Node.js needed.

## Run on WAMP

1. Copy this whole `stop-alert` folder to `C:\wamp64\www\`
2. Start WAMP (icon must be green)
3. Open `http://localhost/phpmyadmin`, go to the **Import** tab on the home page, choose `database.sql`, click **Import**
   (this creates the `stop_alert` database with tables and sample data)
4. Open **`http://localhost/stop-alert/`** in the browser

If your tables are in a different database (for example `bus`), change `DB_NAME` in `config.php`.
If your MySQL root has a password, set `DB_PASS` in `config.php`.

Do not double-click `index.html`. PHP only runs through `http://localhost/...`.

## Use on a phone

Phone and laptop on the same WiFi, then open `http://<laptop-ip>/stop-alert/` (find the IP with `ipconfig`).
Allow Apache through the Windows firewall if the page does not open.

Important: browsers only allow GPS on **HTTPS** pages (localhost is the only exception). On a phone over plain http, **Demo ride** works but **Live GPS** will not. For Live GPS on a phone, deploy to a host with HTTPS or use a tunnel such as ngrok.

## Limits of a web app

- If the phone screen locks, the browser may stop GPS. Keep the screen on and the phone charging.
- Vibration works on Android Chrome. iPhone Safari does not support web vibration (sound only).
- Reliable background alerts need a native app (Capacitor, React Native or Flutter).

## Add stops and routes

Insert rows into `stops`, `routes` and `route_stops` (see `database.sql`). `stop_order` is the travel order. Refresh the page and the new route appears on the map.

## Files

```
stop-alert/
  index.html     app page
  css/style.css  design
  js/app.js      map, GPS, demo ride, alarm
  api.php        JSON API (routes, trips, history)
  config.php     database settings
  database.sql   MySQL schema + sample data
```

## Author

Chandrakumar Vishanan
