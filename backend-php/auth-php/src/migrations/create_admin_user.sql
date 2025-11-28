INSERT INTO users (name, email, password, email_verified_at, role, is_admin) 
VALUES ('Admin', 'swimlive669@gmail.com', '$2y$10$Y4GFs7QEk3oACFTL6artF.TjJvb.gnErHOS.hMhXpNpyzPLBzqbau', NOW(), 'admin', TRUE)
ON DUPLICATE KEY UPDATE password = '$2y$10$Y4GFs7QEk3oACFTL6artF.TjJvb.gnErHOS.hMhXpNpyzPLBzqbau', email_verified_at = NOW(), role = 'admin', is_admin = TRUE;
