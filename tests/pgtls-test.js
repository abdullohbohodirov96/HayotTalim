/* PostgreSQL TLS: sertifikat standart holatda tekshiriladi, env bilan o'zgartiriladi.
     node tests/pgtls-test.js                                                  */
'use strict';
const { pgConf, pgSslOptions, stripSslParams } = require('../server/store');
let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (e ? '  → ' + e : '')); } };
const NEON = 'postgresql://u:p@ep-cool-1.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
delete process.env.PG_SSL_NO_VERIFY; delete process.env.PG_CA_CERT; delete process.env.PGSSLROOTCERT; delete process.env.PGSSLMODE;
const o1 = pgSslOptions(pgConf(NEON));
ok('Neon: SSL yoqilgan va sertifikat tekshiriladi', o1 && o1.rejectUnauthorized === true, JSON.stringify(o1));
ok('Render ichki manzil: SSL yo’q', pgSslOptions(pgConf('postgresql://u:p@dpg-abc123-a/db')) === false);
ok('localhost: SSL yo’q', pgSslOptions(pgConf('postgresql://u:p@localhost:5432/db')) === false);
const s1 = stripSslParams(NEON);
ok('Manzildan sslmode olib tashlandi (pg sozlamani almashtirmasin)', !/sslmode/.test(s1) && /channel_binding=require/.test(s1), s1);
process.env.PG_CA_CERT = '-----BEGIN CERTIFICATE-----\\nAAA\\n-----END CERTIFICATE-----';
const o2 = pgSslOptions(pgConf(NEON));
ok('PG_CA_CERT berilsa — o’sha CA bilan tekshiriladi', o2.rejectUnauthorized === true && /BEGIN CERTIFICATE-----\nAAA/.test(o2.ca || ''));
delete process.env.PG_CA_CERT;
process.env.PG_SSL_NO_VERIFY = '1';
const o3 = pgSslOptions(pgConf(NEON));
ok('PG_SSL_NO_VERIFY=1 — faqat aniq so’ralganda o’chiriladi', o3.rejectUnauthorized === false);
delete process.env.PG_SSL_NO_VERIFY;
console.log('\n' + (fail ? '✗ XATOLAR BOR — ' + pass + " ta o'tdi, " + fail + ' ta xato' : '✓ HAMMASI O’TDI — ' + pass + " ta o'tdi, 0 ta xato"));
process.exit(fail ? 1 : 0);
