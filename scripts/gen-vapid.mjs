import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

let body = '';
if (fs.existsSync(envPath)) {
  body = fs.readFileSync(envPath, 'utf8');
} else if (fs.existsSync(examplePath)) {
  body = fs.readFileSync(examplePath, 'utf8');
}

function setKey(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) return text.replace(re, `${key}=${value}`);
  return text + (text.endsWith('\n') || text === '' ? '' : '\n') + `${key}=${value}\n`;
}

body = setKey(body, 'VAPID_PUBLIC_KEY', publicKey);
body = setKey(body, 'VAPID_PRIVATE_KEY', privateKey);
if (!/^VAPID_SUBJECT=/m.test(body)) {
  body = setKey(body, 'VAPID_SUBJECT', 'mailto:you@example.com');
}

fs.writeFileSync(envPath, body);
console.log('VAPID keys written to .env');
console.log('  public:  ' + publicKey);
console.log('  private: ' + privateKey.slice(0, 6) + '... (hidden)');
console.log('Edit VAPID_SUBJECT in .env if you want a real contact.');
