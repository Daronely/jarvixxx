<?php
/**
 * Jarvixxx — contact form endpoint
 * PHP 8 + SQLite, honeypot + rate limit (5/hour/IP), strict validation.
 */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

define('JX_DB', __DIR__ . '/../../jarvixxx_data/contact.sqlite');
define('RATE_LIMIT', 5);
define('RATE_WINDOW', 3600);

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function ip(): string {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'] as $h) {
        if (!empty($_SERVER[$h])) {
            $v = trim(explode(',', $_SERVER[$h])[0]);
            if (filter_var($v, FILTER_VALIDATE_IP)) return $v;
        }
    }
    return '0.0.0.0';
}

$db = null;
try {
    $dir = dirname(JX_DB);
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    $db = new SQLite3(JX_DB);
    $db->busyTimeout(4000);
    $db->exec('PRAGMA journal_mode = WAL');
    $db->exec('CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, email TEXT NOT NULL, topic TEXT NOT NULL DEFAULT "other",
        subject TEXT NOT NULL DEFAULT "", message TEXT NOT NULL,
        ip TEXT NOT NULL, created_at INTEGER NOT NULL
    )');
    /* v2 migration: add subject column for pre-existing installs */
    $cols = [];
    $q = $db->query("PRAGMA table_info(messages)");
    while ($row = $q->fetchArray(SQLITE3_ASSOC)) $cols[$row['name']] = true;
    if (!isset($cols['subject'])) $db->exec('ALTER TABLE messages ADD COLUMN subject TEXT NOT NULL DEFAULT ""');
    $db->exec('CREATE TABLE IF NOT EXISTS rate (ip TEXT NOT NULL, ts INTEGER NOT NULL)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_rate ON rate(ip, ts)');
} catch (Throwable $e) {
    fail(500, 'storage-error');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'method');

$raw = file_get_contents('php://input');
if (strlen($raw) > 20480) fail(413, 'too-large');
$in = json_decode($raw, true);
if (!is_array($in)) fail(400, 'bad-json');

/* honeypot: any value = bot, answer 200 to not leak detection */
if (!empty($in['website'])) {
    echo json_encode(['ok' => true]);
    exit;
}

$name    = trim((string)($in['name'] ?? ''));
$email   = trim((string)($in['email'] ?? ''));
$topic   = (string)($in['topic'] ?? 'other');
$subject = trim((string)($in['subject'] ?? ''));
$message = trim((string)($in['message'] ?? ''));

if (mb_strlen($name) < 2 || mb_strlen($name) > 80) fail(400, 'bad-name');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 120) fail(400, 'bad-email');
$allowedTopics = ['idea', 'commercial', 'bespoke', 'feedback', 'other'];
if (!in_array($topic, $allowedTopics, true)) $topic = 'other';
if (mb_strlen($subject) > 120) $subject = mb_substr($subject, 0, 120);
if (mb_strlen($message) < 10 || mb_strlen($message) > 3000) fail(400, 'bad-message');

$ip = ip();
$now = time();

/* rate limit */
$st = $db->prepare('SELECT COUNT(*) c FROM rate WHERE ip = ? AND ts > ?');
$st->bindValue(1, $ip, SQLITE3_TEXT);
$st->bindValue(2, $now - RATE_WINDOW, SQLITE3_INTEGER);
$row = $st->execute()->fetchArray(SQLITE3_NUM);
if ((int)$row[0] >= RATE_LIMIT) fail(429, 'rate-limited');
$ri = $db->prepare('INSERT INTO rate (ip, ts) VALUES (?, ?)');
$ri->bindValue(1, $ip, SQLITE3_TEXT);
$ri->bindValue(2, $now, SQLITE3_INTEGER);
$ri->execute();
$db->exec('DELETE FROM rate WHERE ts < ' . ($now - RATE_WINDOW * 2));

/* store */
$ins = $db->prepare('INSERT INTO messages (name, email, topic, subject, message, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
$ins->bindValue(1, $name, SQLITE3_TEXT);
$ins->bindValue(2, $email, SQLITE3_TEXT);
$ins->bindValue(3, $topic, SQLITE3_TEXT);
$ins->bindValue(4, $subject, SQLITE3_TEXT);
$ins->bindValue(5, $message, SQLITE3_TEXT);
$ins->bindValue(6, $ip, SQLITE3_TEXT);
$ins->bindValue(7, $now, SQLITE3_INTEGER);
$ins->execute();

/* cleanup old messages after 12 months, opportunistic */
if (random_int(1, 50) === 1) {
    $db->exec('DELETE FROM messages WHERE created_at < ' . ($now - 31536000));
}

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
