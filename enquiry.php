<?php

//Mailbox the enquiries are sent through (an existing one from cPanel > Email Accounts). This
//hosting does not allow PHP's mail(), so the script logs in to this mailbox and sends from it,
//like an email app would. Replies go to the visitor's own email (Reply-To), not to this mailbox.
$smtp_host = 'sgmsonlinesolutions.com';
$smtp_port = 465;
$smtp_user = 'directors@sgmsonlinesolutions.com';
$smtp_pass = '';	//the password of the mailbox above

//Retrieve form data.
//GET - user submitted data using AJAX
//POST - in case user does not support javascript, we'll use POST instead
function formvalue($key) {
	$value = isset($_GET[$key]) && $_GET[$key] !== '' ? $_GET[$key] : (isset($_POST[$key]) ? $_POST[$key] : '');
	return is_string($value) ? trim($value) : '';
}
$name = formvalue('name');
$phone = formvalue('phone');
$email = formvalue('email');
$organisation = formvalue('organisation');
$service = formvalue('service');
$comment = formvalue('message');

//flag to indicate which method it uses. If POST set it to 1
$post = $_POST ? 1 : 0;

//Simple server side validation
$errors = array();
if (!$name) $errors[count($errors)] = 'Please enter your name.';
//Indian mobile: 10 digits starting 6-9, optionally with +91, 91 or 0 in front (same rule as the form)
if (!$phone) $errors[count($errors)] = 'Please enter your mobile number.';
else if (!preg_match('/^(\+?91|0)?[6-9]\d{9}$/', preg_replace('/[\s\-()]/', '', $phone))) $errors[count($errors)] = 'Please enter a valid 10-digit mobile number.';
if (!$email) $errors[count($errors)] = 'Please enter your email address.';
else if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[count($errors)] = 'Please enter a valid email address.';
if (!$organisation) $errors[count($errors)] = 'Please enter your bank or organisation.';
if (!$service) $errors[count($errors)] = 'Please select a service.';
if (!$comment) $errors[count($errors)] = 'Please enter your message.';

//if the errors array is empty, send the mail
if (!$errors) {

	//recipient - replace your email here
	$to = 'curlykicksss@gmail.com';
	//sender - the visitor's name, sent from an address on this website's domain
	$from = str_replace(array("\r", "\n", '<', '>', '"'), '', $name) . ' <' . $smtp_user . '>';

	//subject and the html message
	$subject = 'Enquiry: ' . str_replace(array("\r", "\n"), ' ', $service) . ' - ' . str_replace(array("\r", "\n"), ' ', $name);
	$subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
	$message = 'Name: ' . htmlspecialchars($name) . '<br/><br/>
		       Mobile: ' . htmlspecialchars($phone) . '<br/><br/>
		       Email: ' . htmlspecialchars($email) . '<br/><br/>
		       Organisation: ' . htmlspecialchars($organisation) . '<br/><br/>
		       Service: ' . htmlspecialchars($service) . '<br/><br/>
		       Message: ' . nl2br(htmlspecialchars($comment)) . '<br/>';

	//send the mail
	//replies go straight to the visitor (the address passed validation above, so it is header-safe)
	$result = sendmail($to, $subject, $message, $from, $email);

	//if POST was used, display the message straight away
	if ($_POST) {
		if ($result) echo 'Thank you! We have received your message.';
		else echo 'Sorry, unexpected error. Please try again later';

	//else if GET was used, return the boolean value so that
	//ajax script can react accordingly
	//1 means success, 0 means failed
	} else {
		echo $result;
	}

//if the errors array has values
} else {
	//display the errors message
	for ($i=0; $i<count($errors); $i++) echo $errors[$i] . '<br/>';
	echo '<a href="contact.html">Back</a>';
	exit;
}


//Simple mail function with HTML header: through the mailbox when its password is set,
//otherwise with PHP's mail(). Any failure returns 0 instead of crashing the page.
function sendmail($to, $subject, $message, $from, $replyto) {
	global $smtp_host, $smtp_pass;
	$headers = "MIME-Version: 1.0" . "\r\n";
	$headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
	$headers .= 'From: ' . $from . "\r\n";
	$headers .= 'Reply-To: ' . $replyto . "\r\n";

	//Routes to the mail server, tried in order until one works. Hosting firewalls often stop
	//a website from connecting out to the public mail address, but allow the same mail
	//server on this machine (127.0.0.1); the certificate is not checked there because the
	//connection never leaves the server.
	$routes = array(
		array('ssl://' . $smtp_host . ':465', false, true),
		array('tcp://' . $smtp_host . ':587', true, true),
		array('tcp://127.0.0.1:587', true, false),
		array('tcp://127.0.0.1:25', true, false),
		array('tcp://127.0.0.1:25', false, false),
	);

	$result = false;
	try {
		if ($smtp_pass !== '') {
			foreach ($routes as $route) {
				$result = smtpmail($route[0], $route[1], $route[2], $to, $subject, $message, $headers);
				if ($result) break;
			}
		}
		if (!$result && function_exists('mail')) {
			$result = mail($to, $subject, $message, $headers);
			if (!$result) maillog('mail(): failed');
		}
	} catch (Throwable $e) {
		maillog('error: ' . $e->getMessage());
		$result = false;
	}

	if ($result) return 1;
	else return 0;
}

//Notes why a send failed, in a file outside public_html (one folder above the website)
//so visitors can never open it. Read it in cPanel > File Manager: enquiry-mail.log
function maillog($line) {
	$file = dirname(__DIR__) . '/enquiry-mail.log';
	if (!@file_put_contents($file, date('Y-m-d H:i:s') . '  ' . $line . "\n", FILE_APPEND)) error_log('enquiry.php: ' . $line);
}

//Sends one email by logging in to the mailbox. $starttls upgrades a plain connection to an
//encrypted one first; $verify checks the server's certificate
function smtpmail($address, $starttls, $verify, $to, $subject, $message, $headers) {
	global $smtp_host, $smtp_user, $smtp_pass;
	$context = stream_context_create(array('ssl' => array(
		'verify_peer' => $verify, 'verify_peer_name' => $verify, 'allow_self_signed' => !$verify, 'peer_name' => $smtp_host,
	)));
	$fp = @stream_socket_client($address, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
	if (!$fp) { maillog($address . ' connect: ' . $errstr . ' (' . $errno . ')'); return false; }
	stream_set_timeout($fp, 20);

	//sends a command (or nothing, for the greeting) and checks the server's reply code
	$last = '';
	$say = function ($command, $code, $step) use ($fp, &$last) {
		if ($command !== null) fwrite($fp, $command . "\r\n");
		$reply = '';
		while (($line = fgets($fp, 515)) !== false) {
			$reply = $line;
			if (isset($line[3]) && $line[3] === ' ') break;
		}
		$last = $step . ': ' . ($reply === '' ? 'no reply' : trim($reply));
		return substr($reply, 0, 3) === $code;
	};

	$ok = $say(null, '220', 'greeting') && $say('EHLO ' . $smtp_host, '250', 'EHLO');
	if ($ok && $starttls) {
		$ok = $say('STARTTLS', '220', 'STARTTLS')
			&& stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)
			&& $say('EHLO ' . $smtp_host, '250', 'EHLO after STARTTLS');
	}
	$ok = $ok
		&& $say('AUTH LOGIN', '334', 'AUTH')
		&& $say(base64_encode($smtp_user), '334', 'username')
		&& $say(base64_encode($smtp_pass), '235', 'password')
		&& $say('MAIL FROM:<' . $smtp_user . '>', '250', 'MAIL FROM')
		&& $say('RCPT TO:<' . $to . '>', '250', 'RCPT TO')
		&& $say('DATA', '354', 'DATA')
		&& $say('Date: ' . date('r') . "\r\n"
			. 'To: <' . $to . ">\r\n"
			. 'Subject: ' . $subject . "\r\n"
			. $headers . "\r\n"
			. preg_replace('/^\./m', '..', str_replace(array("\r\n", "\n"), array("\n", "\r\n"), $message)) . "\r\n.", '250', 'message');

	if ($ok) fwrite($fp, "QUIT\r\n");
	else maillog($address . ' ' . $last);
	fclose($fp);
	return $ok;
}

?>
