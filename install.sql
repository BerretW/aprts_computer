CREATE TABLE IF NOT EXISTS `player_computers` (
  `id` varchar(50) NOT NULL,
  `owner` varchar(50) DEFAULT NULL COMMENT 'Identifier majitele',
  `data` longtext DEFAULT NULL COMMENT 'JSON: filesystem, apps, settings',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;