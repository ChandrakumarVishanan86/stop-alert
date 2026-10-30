-- Stop Alert database (WAMP / MySQL)
-- phpMyAdmin: open the HOME page of phpMyAdmin -> Import tab -> choose this file -> Import.
-- Sample coordinates are approximate. Verify before real use.

CREATE DATABASE IF NOT EXISTS stop_alert CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stop_alert;

DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS route_stops;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS stops;

CREATE TABLE stops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  INDEX idx_stop_name (name)
) ENGINE=InnoDB;

CREATE TABLE routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_number VARCHAR(20),
  name VARCHAR(150) NOT NULL,
  vehicle_type ENUM('bus','train','van','car','other') NOT NULL DEFAULT 'bus'
) ENGINE=InnoDB;

CREATE TABLE route_stops (
  route_id INT NOT NULL,
  stop_id INT NOT NULL,
  stop_order INT NOT NULL,
  PRIMARY KEY (route_id, stop_id),
  INDEX idx_route_order (route_id, stop_order),
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- One row per journey. device_id is a random id stored in the phone browser (no login needed).
CREATE TABLE trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL,
  route_id INT NULL,
  stop_id INT NOT NULL,
  alert_distance_m INT NOT NULL DEFAULT 1000,
  mode ENUM('live','demo') NOT NULL DEFAULT 'live',
  status ENUM('active','alerted','completed','cancelled') NOT NULL DEFAULT 'active',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  INDEX idx_device (device_id, id),
  FOREIGN KEY (stop_id) REFERENCES stops(id),
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Stops ----------
INSERT INTO stops (id, name, latitude, longitude) VALUES
 (1,'Colombo Fort',6.9335,79.8500),
 (2,'Kiribathgoda',6.9786,79.9283),
 (3,'Kadawatha',7.0010,79.9506),
 (4,'Veyangoda',7.1553,80.0617),
 (5,'Nittambuwa',7.1422,80.0975),
 (6,'Warakapola',7.2253,80.1982),
 (7,'Kegalle',7.2513,80.3464),
 (8,'Mawanella',7.2530,80.4450),
 (9,'Kadugannawa',7.2539,80.5240),
 (10,'Peradeniya',7.2597,80.5951),
 (11,'Kandy',7.2906,80.6337),
 (12,'Bambalapitiya',6.8886,79.8560),
 (13,'Mount Lavinia',6.8389,79.8653),
 (14,'Moratuwa',6.7730,79.8816),
 (15,'Panadura',6.7132,79.9026),
 (16,'Kalutara',6.5854,79.9607),
 (17,'Beruwala',6.4788,79.9828),
 (18,'Bentota',6.4260,79.9958),
 (19,'Ambalangoda',6.2357,80.0538),
 (20,'Hikkaduwa',6.1395,80.1063),
 (21,'Galle',6.0329,80.2168),
 (22,'Weligama',5.9745,80.4297),
 (23,'Matara',5.9485,80.5353),
 (24,'Kurunegala',7.4863,80.3647),
 (25,'Dambulla',7.8600,80.6518),
 (26,'Anuradhapura',8.3114,80.4037),
 (27,'Vavuniya',8.7514,80.4971),
 (28,'Kilinochchi',9.3803,80.3770),
 (29,'Jaffna',9.6615,80.0255),
 (30,'Peliyagoda',6.9680,79.8800),
 (31,'Wattala',6.9894,79.8903),
 (32,'Ja-Ela',7.0744,79.8919),
 (33,'Katunayake',7.1700,79.8850),
 (34,'Negombo',7.2086,79.8358),
 (35,'Gampola',7.1643,80.5686),
 (36,'Nawalapitiya',7.0500,80.5333),
 (37,'Hatton',6.8913,80.5957),
 (38,'Talawakele',6.9378,80.6580),
 (39,'Nuwara Eliya',6.9497,80.7891);

-- ---------- Routes ----------
INSERT INTO routes (id, route_number, name, vehicle_type) VALUES
 (1,'1','Colombo - Kandy','bus'),
 (2,'2','Colombo - Galle','bus'),
 (3,'3','Colombo - Matara','bus'),
 (4,'4','Colombo - Jaffna','bus'),
 (5,'5','Colombo - Negombo','bus'),
 (6,'6','Kandy - Nuwara Eliya','bus');

-- ---------- Stops of each route (in travel order) ----------
INSERT INTO route_stops (route_id, stop_id, stop_order) VALUES
 (1,1,1),(1,2,2),(1,3,3),(1,4,4),(1,5,5),(1,6,6),(1,7,7),(1,8,8),(1,9,9),(1,10,10),(1,11,11),
 (2,1,1),(2,12,2),(2,13,3),(2,14,4),(2,15,5),(2,16,6),(2,17,7),(2,18,8),(2,19,9),(2,20,10),(2,21,11),
 (3,1,1),(3,12,2),(3,13,3),(3,14,4),(3,15,5),(3,16,6),(3,17,7),(3,18,8),(3,19,9),(3,20,10),(3,21,11),(3,22,12),(3,23,13),
 (4,1,1),(4,3,2),(4,24,3),(4,25,4),(4,26,5),(4,27,6),(4,28,7),(4,29,8),
 (5,1,1),(5,30,2),(5,31,3),(5,32,4),(5,33,5),(5,34,6),
 (6,11,1),(6,10,2),(6,35,3),(6,36,4),(6,37,5),(6,38,6),(6,39,7);
