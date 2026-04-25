-- ══════════════════════════════════════════════
--  QUIZMASTER — Database Schema + Seed Data
--  Run this file in MySQL CLI:
--  source C:/Users/hp/Desktop/quizmaster/database.sql
-- ══════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS quizmaster;
USE quizmaster;

-- ── TABLES ────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  role       ENUM('student','admin') DEFAULT 'student',
  created_at DATETIME DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quizzes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  category    VARCHAR(100),
  time_per_q  INT DEFAULT 30,
  created_by  INT NOT NULL,
  is_active   TINYINT DEFAULT 1,
  created_at  DATETIME DEFAULT NOW(),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id       INT NOT NULL,
  question_text TEXT NOT NULL,
  q_type        ENUM('mcq','tf') DEFAULT 'mcq',
  explanation   TEXT,
  position      INT DEFAULT 1,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS options (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  question_id  INT NOT NULL,
  option_text  VARCHAR(500) NOT NULL,
  is_correct   TINYINT DEFAULT 0,
  option_order INT DEFAULT 1,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attempts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  quiz_id     INT NOT NULL,
  score       INT DEFAULT 0,
  total_q     INT DEFAULT 0,
  started_at  DATETIME DEFAULT NOW(),
  finished_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attempt_answers (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  attempt_id   INT NOT NULL,
  question_id  INT NOT NULL,
  selected_opt INT,
  is_correct   TINYINT DEFAULT 0,
  FOREIGN KEY (attempt_id)  REFERENCES attempts(id)  ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- ── SEED DATA ─────────────────────────────────

-- Default admin user (password: admin123)
INSERT IGNORE INTO users (name, email, password, role) VALUES
('Admin User', 'admin@quizmaster.com',
 '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgRCd5B.1ztIBFbPNYGLbm', 'admin');

-- Default student user (password: student123)
INSERT IGNORE INTO users (name, email, password, role) VALUES
('Student User', 'student@quizmaster.com',
 '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uHIPeVslm', 'student');

-- ── SAMPLE QUIZZES ────────────────────────────

INSERT IGNORE INTO quizzes (id, title, description, category, time_per_q, created_by) VALUES
(1, 'General Knowledge Basics', 'Test your general knowledge with this fun quiz!', 'General Knowledge', 30, 1),
(2, 'Computer Science Fundamentals', 'Basic CS concepts every student should know.', 'Technology', 25, 1);

-- Questions for Quiz 1
INSERT IGNORE INTO questions (id, quiz_id, question_text, q_type, explanation, position) VALUES
(1, 1, 'Which planet is known as the Red Planet?', 'mcq', 'Mars is called the Red Planet because of the reddish color of its surface, caused by iron oxide (rust) in its soil.', 1),
(2, 1, 'The Great Wall of China is visible from space with the naked eye.', 'tf', 'This is a popular myth. The Great Wall is not visible from space with the naked eye — it is too narrow.', 2),
(3, 1, 'What is the chemical symbol for Gold?', 'mcq', 'Gold''s symbol "Au" comes from the Latin word "Aurum".', 3),
(4, 1, 'Oxygen is the most abundant element in Earth''s atmosphere.', 'tf', 'Nitrogen makes up about 78% of Earth''s atmosphere. Oxygen is only about 21%.', 4),
(5, 1, 'How many continents are there on Earth?', 'mcq', 'There are 7 continents: Africa, Antarctica, Asia, Australia, Europe, North America, and South America.', 5);

-- Options for Quiz 1, Q1
INSERT IGNORE INTO options (question_id, option_text, is_correct, option_order) VALUES
(1, 'Venus', 0, 1), (1, 'Mars', 1, 2), (1, 'Jupiter', 0, 3), (1, 'Saturn', 0, 4);
-- Options for Quiz 1, Q2 (True/False)
INSERT IGNORE INTO options (question_id, option_text, is_correct, option_order) VALUES
(2, 'True', 0, 1), (2, 'False', 1, 2);
-- Options for Quiz 1, Q3
INSERT IGNORE INTO options (question_id, option_text, is_correct, option_order) VALUES
(3, 'Go', 0, 1), (3, 'Gd', 0, 2), (3, 'Au', 1, 3), (3, 'Ag', 0, 4);
-- Options for Quiz 1, Q4 (True/False)
INSERT IGNORE INTO options (question_id, option_text, is_correct, option_order) VALUES
(4, 'True', 0, 1), (4, 'False', 1, 2);
-- Options for Quiz 1, Q5
INSERT IGNORE INTO options (question_id, option_text, is_correct, option_order) VALUES
(5, '5', 0, 1), (5, '6', 0, 2), (5, '7', 1, 3), (5, '8', 0, 4);

-- Questions for Quiz 2
INSERT IGNORE INTO questions (id, quiz_id, question_text, q_type, explanation, position) VALUES
(6, 2, 'What does HTML stand for?', 'mcq', 'HTML stands for HyperText Markup Language. It is the standard language for creating web pages.', 1),
(7, 2, 'Python is a compiled programming language.', 'tf', 'Python is an interpreted language. Code is executed line by line by the Python interpreter.', 2),
(8, 2, 'Which data structure works on the LIFO principle?', 'mcq', 'Stack follows LIFO (Last In, First Out). The last element added is the first one removed.', 3),
(9, 2, 'What does CSS stand for?', 'mcq', 'CSS stands for Cascading Style Sheets. It is used to style and layout HTML documents.', 4),
(10, 2, 'JavaScript can only run in a web browser.', 'tf', 'JavaScript can run outside browsers using Node.js, which allows server-side execution.', 5);

-- Options for Quiz 2, Q6
INSERT IGNORE INTO options (question_id, option_text, is_correct, option_order) VALUES
(6, 'Hyper Text Makeup Language', 0, 1),
(6, 'Hyper Text Markup Language', 1, 2),
(6, 'High Tech Modern Language', 0, 3),
(6, 'Hyper Transfer Markup Language', 0, 4);
-- Options for Quiz 2, Q7 (True/False)
INSERT IGNORE INTO options (question_id, option_text, is_correct, option_order) VALUES
(7, 'True', 0, 1), (7, 'False', 1, 2);
-- Options for Quiz 2, Q8
INSERT IGNORE INTO options (question_id, option_text, is_correct, option_order) VALUES
(8, 'Queue', 0, 1), (8, 'Array', 0, 2), (8, 'Stack', 1, 3), (8, 'Linked List', 0, 4);
-- Options for Quiz 2, Q9
INSERT IGNORE INTO options (question_id, option_text, is_correct, option_order) VALUES
(9, 'Cascading Style Sheets', 1, 1),
(9, 'Computer Style Syntax', 0, 2),
(9, 'Creative Style Scripts', 0, 3),
(9, 'Cascading Simple Styles', 0, 4);
-- Options for Quiz 2, Q10 (True/False)
INSERT IGNORE INTO options (question_id, option_text, is_correct, option_order) VALUES
(10, 'True', 0, 1), (10, 'False', 1, 2);

SELECT 'QuizMaster database setup complete!' AS Status;
SELECT CONCAT('Tables created: ', COUNT(*)) AS Info FROM information_schema.tables WHERE table_schema = 'quizmaster';
