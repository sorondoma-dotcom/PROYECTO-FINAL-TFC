<?php
namespace App\Services;

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;

class MailService
{
    private PHPMailer $mailer;
    private bool $enabled;

    public function __construct()
    {
        $this->enabled = filter_var(env('MAIL_ENABLED', 'true'), FILTER_VALIDATE_BOOL);
        $this->mailer = new PHPMailer(true);
        $this->configureMailer();
    }

    public function sendVerificationCode(string $recipientEmail, string $recipientName, string $code): void
    {
        if (!$this->enabled) {
            return;
        }

        try {
            $this->mailer->clearAddresses();
            $this->mailer->addAddress($recipientEmail, $recipientName);
            $this->mailer->Subject = 'Confirma tu correo en Live Swim';
            $this->mailer->Body = $this->buildVerificationBody($recipientName, $code);
            $this->mailer->AltBody = $this->mailer->Body;
            $this->mailer->send();
        } catch (MailException $e) {
            throw new \RuntimeException('No se pudo enviar el correo de verificacion: ' . $e->getMessage());
        }
    }

    public function sendPasswordResetCode(string $recipientEmail, string $recipientName, string $code, \DateTimeInterface $expiresAt): void
    {
        if (!$this->enabled) {
            return;
        }

        try {
            $this->mailer->clearAddresses();
            $this->mailer->addAddress($recipientEmail, $recipientName);
            $this->mailer->Subject = 'Codigo para restablecer tu contrasena';
            $this->mailer->Body = $this->buildPasswordResetBody($recipientName, $code, $expiresAt);
            $this->mailer->AltBody = $this->mailer->Body;
            $this->mailer->send();
        } catch (MailException $e) {
            throw new \RuntimeException('No se pudo enviar el correo de recuperacion: ' . $e->getMessage());
        }
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    private function configureMailer(): void
    {
        $host = env('MAIL_HOST');
        $user = env('MAIL_USER');
        $pass = env('MAIL_PASS');
        $from = env('MAIL_FROM');
        $fromName = env('MAIL_FROM_NAME', 'Live Swim');
        $port = (int) env('MAIL_PORT', '587');
        $secure = env('MAIL_SECURE', 'tls');

        if (!$host || !$user || !$pass || !$from) {
            $this->enabled = false;
            return;
        }

        $this->mailer->isSMTP();
        $this->mailer->Host = $host;
        $this->mailer->Port = $port;
        $this->mailer->SMTPAuth = true;
        $this->mailer->Username = $user;
        $this->mailer->Password = $pass;
        $this->mailer->SMTPSecure = $secure;
        $this->mailer->CharSet = 'UTF-8';
        $this->mailer->isHTML(false);
        $this->mailer->setFrom($from, $fromName);
        $debug = strtolower(env('MAIL_DEBUG', 'false')) === 'true';
        $this->mailer->SMTPDebug = $debug ? SMTP::DEBUG_SERVER : SMTP::DEBUG_OFF;
        if ($debug) {
            $this->mailer->Debugoutput = 'error_log';
        }
    }

    private function buildVerificationBody(string $name, string $code): string
    {
        $safeName = trim($name) !== '' ? $name : 'nadador';

        return "Hola {$safeName},\n\n"
            . "Gracias por registrarte en Live Swim. Para confirmar tu correo introduce este codigo:\n\n"
            . "{$code}\n\n"
            . "El codigo expira en 15 minutos.\n\n"
            . "Si no solicitaste esta cuenta, ignora este mensaje.\n";
    }

    private function buildPasswordResetBody(string $name, string $code, \DateTimeInterface $expiresAt): string
    {
        $safeName = trim($name) !== '' ? $name : 'nadador';
        $expiresLocal = $expiresAt->format('d/m/Y H:i');

        return "Hola {$safeName},\n\n"
            . "Recibimos una solicitud para restablecer tu contrasena. Usa este codigo para completar el proceso:\n\n"
            . "{$code}\n\n"
            . "El codigo expira el {$expiresLocal}. Si no pediste el cambio, puedes ignorar este correo.\n";
    }
}
