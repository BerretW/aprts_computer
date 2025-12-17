CREATE TABLE IF NOT EXISTS `player_computers` (
  `id` varchar(50) NOT NULL,
  `owner` varchar(50) DEFAULT NULL COMMENT 'Identifier hráče nebo NULL pro veřejné PC',
  `data` longtext DEFAULT NULL COMMENT 'JSON: apps, wallpaper, colorScheme',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;