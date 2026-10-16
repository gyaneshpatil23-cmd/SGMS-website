<?php
/* Contact form handler: emails the enquiry to the company inbox and answers in JSON. */

// Inbox that receives the enquiries.
const ENQUIRY_TO = 'curlykicksss@gmail.com';

// Sender address. Leave empty to use noreply@<this site's domain>; most hosts only
// deliver mail whose From address is on the hosted domain, so never put a Gmail address here.
const ENQUIRY_FROM = '';

// SMTP mailbox (recommended: mail sent through a real mailbox is far less likely to be marked
// as spam). Create a mailbox such as noreply@yourdomain in the hosting panel (cPanel > Email
// Accounts) and fill these in. Leave SMTP_PASS empty to send with PHP mail() instead.
const SMTP_HOST = 'mail.sgmsonlinesolutions.com'; // shown in cPanel under "Connect Devices"
const SMTP_PORT = 465;                   // 465 = SSL, 587 = STARTTLS
const SMTP_USER = '';                    // the full mailbox address, e.g. noreply@yourdomain.com
const SMTP_PASS = '';                    // the mailbox password

const SERVICES = [
  'Equitable Mortgage (Notice of Intimation)',
  'Registered Mortgage',
  'Challan MTR Form No. 6 / e-SBTR',
  'Documents Collection (PDD & other)',
  'Client Background Checks (FI)',
  'Property Valuation Services',
  'Other',
];

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond(int $status, bool $ok, string $message): void
{
  http_response_code($status);
  echo json_encode(['ok' => $ok, 'message' => $message]);
  exit;
}

/* One line of text: control characters (including the CR/LF used for header injection) removed. */
function field(string $key, int $max): string
{
  $value = isset($_POST[$key]) && is_string($_POST[$key]) ? $_POST[$key] : '';
  $value = trim(preg_replace('/[\x00-\x1F\x7F]+/', ' ', $value));
  return function_exists('mb_substr') ? mb_substr($value, 0, $max, 'UTF-8') : substr($value, 0, $max);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  header('Allow: POST');
  respond(405, false, 'Method not allowed.');
}

// Honeypot: real visitors never see or fill this field, bots usually do. Pretend it worked.
if (!empty($_POST['website'])) {
  respond(200, true, 'Thank you. Your enquiry has been sent.');
}

$name = field('name', 100);
$phone = field('phone', 30);
$organisation = field('organisation', 150);
$service = field('service', 100);

$message = isset($_POST['message']) && is_string($_POST['message']) ? $_POST['message'] : '';
$message = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/', '', str_replace("\r\n", "\n", $message)));
$message = function_exists('mb_substr') ? mb_substr($message, 0, 5000, 'UTF-8') : substr($message, 0, 5000);

if ($name === '' || $phone === '' || $service === '' || $message === '') {
  respond(422, false, 'Please fill in your name, phone, service and message.');
}
if (!preg_match('/^[0-9+()\-\s]{7,30}$/', $phone)) {
  respond(422, false, 'Please enter a valid phone number.');
}
if (!in_array($service, SERVICES, true)) {
  respond(422, false, 'Please select a service from the list.');
}

$useSmtp = SMTP_USER !== '' && SMTP_PASS !== '';
$host = strtolower(preg_replace('/^www\./i', '', $_SERVER['SERVER_NAME'] ?? ''));
if (!preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $host)) {
  $host = 'localhost';
}
// an SMTP server only accepts mail from the mailbox that logged in
$from = $useSmtp ? SMTP_USER : (ENQUIRY_FROM !== '' ? ENQUIRY_FROM : 'noreply@' . $host);

$subject = 'Enquiry: ' . $service . ' - ' . $name;
$body = implode("\n", [
  'New enquiry from the website contact form.',
  '',
  'Name: ' . $name,
  'Phone: ' . $phone,
  'Organisation: ' . ($organisation !== '' ? $organisation : '-'),
  'Service: ' . $service,
  '',
  'Message:',
  $message,
  '',
  '--',
  'Sent on ' . date('d M Y, H:i') . ' from IP ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
]);

$headers = implode("\r\n", [
  'From: SGMS Website <' . $from . '>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: 8bit',
]);

$subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$body = str_replace("\n", "\r\n", $body);

$sent = false;
if ($useSmtp) {
  $sent = smtp_send($host, $from, ENQUIRY_TO, $subject, $headers, $body);
}
// also the fallback when the SMTP server refuses or cannot be reached
if (!$sent) {
  $sent = @mail(ENQUIRY_TO, $subject, $body, $headers, '-f' . $from);
}

if (!$sent) {
  respond(500, false, 'We could not send your enquiry right now. Please call us or email ' . ENQUIRY_TO . '.');
}

respond(200, true, 'Thank you. Your enquiry has been sent and our team will get back to you.');

/* Minimal authenticated SMTP client (no libraries): SSL on 465, STARTTLS on 587, AUTH LOGIN. */
function smtp_send(string $ehlo, string $from, string $to, string $subject, string $headers, string $body): bool
{
  $fp = @fsockopen((SMTP_PORT === 465 ? 'ssl://' : '') . SMTP_HOST, SMTP_PORT, $errno, $errstr, 15);
  if (!$fp) {
    return false;
  }
  stream_set_timeout($fp, 15);

  // sends one command (or just reads the greeting) and checks the reply code
  $expect = function (?string $command, string $code) use ($fp): bool {
    if ($command !== null) {
      fwrite($fp, $command . "\r\n");
    }
    $reply = '';
    while ($line = fgets($fp, 515)) {
      $reply = $line;
      if (isset($line[3]) && $line[3] === ' ') {
        break; // last line of a multi-line reply
      }
    }
    return substr($reply, 0, 3) === $code;
  };

  $ok = $expect(null, '220') && $expect('EHLO ' . $ehlo, '250');
  if ($ok && SMTP_PORT === 587) {
    $ok = $expect('STARTTLS', '220')
      && stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)
      && $expect('EHLO ' . $ehlo, '250');
  }
  $ok = $ok
    && $expect('AUTH LOGIN', '334')
    && $expect(base64_encode(SMTP_USER), '334')
    && $expect(base64_encode(SMTP_PASS), '235')
    && $expect('MAIL FROM:<' . $from . '>', '250')
    && $expect('RCPT TO:<' . $to . '>', '250')
    && $expect('DATA', '354')
    && $expect(
      implode("\r\n", [
        'Date: ' . date('r'),
        'To: <' . $to . '>',
        'Subject: ' . $subject,
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $ehlo . '>',
        $headers,
        '',
        preg_replace('/^\./m', '..', $body), // dot-stuffing
        '.',
      ]),
      '250'
    );

  if ($ok) {
    fwrite($fp, "QUIT\r\n");
  }
  fclose($fp);
  return $ok;
}
